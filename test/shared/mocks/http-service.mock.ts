import { Observable, of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

export class HttpServiceMock {
  private postResponse: any = { data: {} };
  private postShouldError = false;
  private postErrorObj: any = null;

  setPostResponse(response: any): void {
    this.postResponse = response;
    this.postShouldError = false;
  }

  setPostError(error: any): void {
    this.postShouldError = true;
    this.postErrorObj = error;
  }

  post(): Observable<AxiosResponse> {
    if (this.postShouldError) {
      return throwError(() => this.postErrorObj);
    }

    const response: AxiosResponse = {
      data: this.postResponse,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    return of(response);
  }

  get(): Observable<AxiosResponse> {
    return of({ data: {} } as AxiosResponse);
  }

  put(): Observable<AxiosResponse> {
    return of({ data: {} } as AxiosResponse);
  }

  delete(): Observable<AxiosResponse> {
    return of({ data: {} } as AxiosResponse);
  }

  patch(): Observable<AxiosResponse> {
    return of({ data: {} } as AxiosResponse);
  }
}
