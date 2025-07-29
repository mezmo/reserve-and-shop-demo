import PerformanceLogger from './performanceLogger';

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  url: string;
}

export interface HttpError extends Error {
  status: number;
  statusText: string;
  url: string;
  response?: any;
}

export interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

class HttpClient {
  private static instance: HttpClient;
  private logger: PerformanceLogger;
  private baseURL: string = '/api';

  private constructor() {
    this.logger = PerformanceLogger.getInstance();
  }

  static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient();
    }
    return HttpClient.instance;
  }

  private async makeRequest<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<HttpResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = 10000,
      retries = 0,
      retryDelay = 1000
    } = config;

    const url = `${this.baseURL}${endpoint}`;
    const startTime = performance.now();

    const requestInit: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let attempt = 0;
    const maxAttempts = retries + 1;

    while (attempt < maxAttempts) {
      try {
        this.logger.logEntry({
          timestamp: new Date().toISOString(),
          event: 'HTTP_REQUEST_START',
          path: endpoint,
          details: {
            method,
            url,
            attempt: attempt + 1,
            maxAttempts,
            headers: Object.keys(headers),
            hasBody: !!body
          }
        });

        const response = await fetch(url, {
          ...requestInit,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const endTime = performance.now();
        const duration = endTime - startTime;

        let responseData: T;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text() as unknown as T;
        }

        const httpResponse: HttpResponse<T> = {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          url,
        };

        if (!response.ok) {
          // Log HTTP error
          this.logger.logHttpError(
            method,
            url,
            response.status,
            response.statusText,
            duration,
            responseData,
            attempt + 1
          );

          const error: HttpError = new Error(
            `HTTP ${response.status}: ${response.statusText}`
          ) as HttpError;
          error.status = response.status;
          error.statusText = response.statusText;
          error.url = url;
          error.response = responseData;

          // Retry on server errors (5xx) if retries are configured
          if (response.status >= 500 && attempt < maxAttempts - 1) {
            attempt++;
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            continue;
          }

          throw error;
        }

        // Log successful request
        this.logger.logHttpSuccess(
          method,
          url,
          response.status,
          duration,
          this.getResponseSize(response, responseData),
          attempt + 1
        );

        return httpResponse;

      } catch (error) {
        clearTimeout(timeoutId);
        const endTime = performance.now();
        const duration = endTime - startTime;

        if (error instanceof Error && error.name === 'AbortError') {
          // Timeout error
          this.logger.logHttpTimeout(method, url, timeout, attempt + 1);
          
          const timeoutError: HttpError = new Error(
            `Request timeout after ${timeout}ms`
          ) as HttpError;
          timeoutError.status = 408;
          timeoutError.statusText = 'Request Timeout';
          timeoutError.url = url;
          throw timeoutError;
        }

        if (error instanceof TypeError && error.message.includes('fetch')) {
          // Network error
          this.logger.logHttpNetworkError(method, url, error.message, duration, attempt + 1);
          
          const networkError: HttpError = new Error(
            'Network error: Unable to connect to server'
          ) as HttpError;
          networkError.status = 0;
          networkError.statusText = 'Network Error';
          networkError.url = url;
          throw networkError;
        }

        // If it's already an HttpError, check if we should retry
        if (error instanceof Error && 'status' in error) {
          const httpError = error as HttpError;
          if (httpError.status >= 500 && attempt < maxAttempts - 1) {
            attempt++;
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            continue;
          }
        }

        throw error;
      }
    }

    throw new Error('Maximum retry attempts exceeded');
  }

  private getResponseSize(response: Response, data: any): number {
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      return parseInt(contentLength, 10);
    }
    
    // Estimate size from data
    return JSON.stringify(data).length;
  }

  // Convenience methods
  async get<T>(endpoint: string, config?: Omit<RequestConfig, 'method'>): Promise<HttpResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...config, method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...config, method: 'PUT', body });
  }

  async patch<T>(endpoint: string, body?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...config, method: 'PATCH', body });
  }

  async delete<T>(endpoint: string, config?: Omit<RequestConfig, 'method'>): Promise<HttpResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // Test methods for triggering specific errors
  async testError(statusCode: number, delay: number = 0): Promise<HttpResponse> {
    return this.get(`/test/error/${statusCode}?delay=${delay}`);
  }

  async testRandomError(): Promise<HttpResponse> {
    return this.get('/test/random-error');
  }

  async testTimeout(timeout: number = 5000): Promise<HttpResponse> {
    return this.get(`/test/timeout?timeout=${timeout}`, { timeout: timeout + 1000 });
  }

  async testPerformance(delay?: number): Promise<HttpResponse> {
    const queryParam = delay ? `?delay=${delay}` : '';
    return this.get(`/test/performance${queryParam}`);
  }
}

export default HttpClient;