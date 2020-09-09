import { AuthenticationContext, TokenResponse, ErrorResponse, UserCodeInfo, Logging, LoggingLevel } from 'adal-node';
import { Logger, AccessToken } from '../models';
import persist from 'node-persist';

const MS_LOGIN_URL = 'https://login.microsoftonline.com';
const MS_EXPIRES_ON_FILE = 'persist/microsoft.expiresOn';
const MS_TOKEN_FILE = 'persist/microsoft.token';

export interface Hash<TValue> {
  [key: string]: TValue;
}

class AuthService {
  connected: boolean = false;
  refreshToken?: string;
  accessTokens: Hash<AccessToken>;
  tenantId?: string;

  constructor() {
    this.accessTokens = {};
    var fs = require('fs');
    if (fs.existsSync(MS_EXPIRES_ON_FILE) && fs.existsSync(MS_TOKEN_FILE)) {
        const expiresOn = fs.readFileSync(MS_EXPIRES_ON_FILE, 'utf8');
        const value = fs.readFileSync(MS_TOKEN_FILE, 'utf8');
        this.accessTokens['https://graph.microsoft.com'] = {
            expiresOn: expiresOn,
            value: value
        };
    }
  }

  public logout(): void {
    this.connected = false;
    this.accessTokens = {};
    this.refreshToken = undefined;
    this.tenantId = undefined;
  }
}

export class Auth {
  private authCtx: AuthenticationContext = null;
  private service: AuthService = null;
  private userCodeInfo?: UserCodeInfo;

  constructor(private appId: string, private storage: typeof persist) {
    this.service = new AuthService();
    this.authCtx = new AuthenticationContext(`${MS_LOGIN_URL}/common`)
  }

  /**
   * Retrieve an accessToken
   * 
   * @param resource 
   * @param log 
   * @param debug 
   * @param fetchNew 
   */
  public async ensureAccessToken(resource: string, log: Logger, debug: boolean = false, fetchNew: boolean = false): Promise<string | null> {
    try {
      const now: Date = new Date();
      const accessToken: AccessToken | undefined = this.service.accessTokens[resource];
      const expiresOn: Date = accessToken ? new Date(accessToken.expiresOn) : new Date(0);
      
      // Check if there is still an accessToken available
      if (!fetchNew && accessToken && expiresOn > now) {
        if (debug) {
		  log.info(`Resource: ${resource}`);
		  log.info(`Expires on: ${accessToken.expiresOn}`);
          log.info(`Existing access token ${accessToken.value} still valid. Returning...`);
        }
        return accessToken.value;
      } else {
        if (debug) {
          if (!accessToken) {
            log.warn(`No token found for resource ${resource}`);
          } else {
            log.warn(`Access token expired. Token: ${accessToken.value}, ExpiresAt: ${accessToken.expiresOn}`);
          }
        }
      }

      let getTokenPromise = this.ensureAccessTokenWithDeviceCode;
      if (this.service.refreshToken) {
        getTokenPromise = this.ensureAccessTokenWithRefreshToken;
      }

      const tokenResponse = await getTokenPromise(resource, log, debug);
      if (!tokenResponse) {
        return null;
      }

      this.service.accessTokens[resource] = {
        expiresOn: tokenResponse.expiresOn as string,
        value: tokenResponse.accessToken
      };
      
      var fs = require('fs');
      fs.writeFile(MS_EXPIRES_ON_FILE, tokenResponse.expiresOn, function (err) {
        if (err) throw err;
        if (debug){
            log.info(`${MS_EXPIRES_ON_FILE} saved!`);
        }
      });
      fs.writeFile(MS_TOKEN_FILE, tokenResponse.accessToken, function (err) {
        if (err) throw err;
        if (debug){
            log.info(`${MS_TOKEN_FILE} saved!`);
        }
      });
      this.service.refreshToken = tokenResponse.refreshToken;
      this.service.connected = true;

      await this.storeConnectionInfo(resource);

      return this.service.accessTokens[resource].value;
    } catch (error) {
      log.error(`Failed to retrieve an accessToken: ${error.message}`);
      return null;
    }
  }

  /**
   * Cancel the device token flow
   */
  public cancel(): void {
    if (this.userCodeInfo) {
      this.authCtx.cancelRequestToGetTokenWithDeviceCode(this.userCodeInfo as UserCodeInfo, (error: Error, response: TokenResponse | ErrorResponse): void => { });
    }
  }

  /**
   * Retrieve a new accessToken via the device flow
   * 
   * @param resource
   * @param log
   * @param debug
   */
  private ensureAccessTokenWithDeviceCode = (resource: string, log: Logger, debug: boolean): Promise<TokenResponse> => {
    if (debug) {
      log.info(`Starting Auth.ensureAccessTokenWithDeviceCode. resource: ${resource}, debug: ${debug}`);
    }

    return new Promise<TokenResponse>((resolve: (tokenResponse: TokenResponse) => void, reject: (err: any) => void) => {
      if (debug) {
        log.info('No existing refresh token. Starting new device code flow...');
      }

      this.authCtx.acquireUserCode(resource, this.appId as string, 'en-us',
        (error: Error, response: UserCodeInfo): void => {
          if (debug) {
            log.info('Response:');
            log.info(response);
            log.info('');
          }

          if (error) {
            reject((response && (response as any).error_description) || error.message);
            return;
          }

          log.info(response.message);

          this.userCodeInfo = response;
          this.authCtx.acquireTokenWithDeviceCode(resource, this.appId as string, response,
            (error: Error, response: TokenResponse | ErrorResponse): void => {
              if (debug) {
                log.info('Response:');
                log.info(response);
                log.info('');
              }

              if (error) {
                reject((response && (response as any).error_description) || error.message || (error as any).error_description);
                return;
              }

              this.userCodeInfo = undefined;
              resolve(<TokenResponse>response);
            });
        });
    });
  }

  /**
   * Retrieve a new accessToken via the refresh token
   * 
   * @param resource
   * @param log
   * @param debug
   */
  private ensureAccessTokenWithRefreshToken = (resource: string, log: Logger, debug: boolean): Promise<TokenResponse> => {
    return new Promise<TokenResponse>((resolve: (tokenResponse: TokenResponse) => void, reject: (error: any) => void): void => {
      if (debug) {
        log.info(`Retrieving new access token using existing refresh token ${this.service.refreshToken}`);
      }

      this.authCtx.acquireTokenWithRefreshToken(
        this.service.refreshToken as string,
        this.appId as string,
        resource,
        (error: Error, response: TokenResponse | ErrorResponse): void => {
          if (debug) {
            log.info('Response:');
            log.info(response);
            log.info('');
          }

          if (error) {
            reject((response && (response as any).error_description) || error.message);
            return;
          }

          resolve(<TokenResponse>response);
        });
    });
  }

  /**
   * Store the connection information
   */
  private storeConnectionInfo = async (resource: string): Promise<void> => {
    await this.storage.set(`${this.appId}-${resource}`, JSON.stringify(this.service));
  }
}
