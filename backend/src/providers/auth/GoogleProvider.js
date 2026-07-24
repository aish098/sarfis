const { OAuth2Client } = require('google-auth-library');

class GoogleProvider {
  constructor(clientId) {
    this.clientId = clientId || process.env.GOOGLE_CLIENT_ID;
    if (this.clientId) {
      this.client = new OAuth2Client(this.clientId);
    }
  }

  /**
   * Verifies Google ID token and returns standardized profile claims
   */
  async verifyIdentity(idToken) {
    if (!idToken || typeof idToken !== 'string') {
      const err = new Error('Google credential token is required');
      err.code = 'GOOGLE_TOKEN_REQUIRED';
      err.statusCode = 400;
      throw err;
    }

    if (!this.clientId) {
      const err = new Error('GOOGLE_CLIENT_ID is not configured on backend server');
      err.code = 'SERVER_CONFIG_ERROR';
      err.statusCode = 500;
      throw err;
    }

    let ticket;
    try {
      ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId
      });
    } catch (error) {
      const err = new Error('Google credential token is invalid or expired');
      err.code = 'INVALID_GOOGLE_TOKEN';
      err.statusCode = 401;
      throw err;
    }

    const payload = ticket.getPayload();

    if (!payload?.sub) {
      const err = new Error('Google credential does not contain a valid subject (sub)');
      err.code = 'INVALID_GOOGLE_TOKEN';
      err.statusCode = 401;
      throw err;
    }

    if (!payload.email || payload.email_verified !== true) {
      const err = new Error('A verified Google email address is required');
      err.code = 'GOOGLE_EMAIL_NOT_VERIFIED';
      err.statusCode = 403;
      throw err;
    }

    return {
      provider: 'GOOGLE',
      subject: payload.sub,
      email: payload.email.trim().toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name || null,
      givenName: payload.given_name || null,
      familyName: payload.family_name || null,
      pictureUrl: payload.picture || null,
      hostedDomain: payload.hd ? payload.hd.trim().toLowerCase() : null
    };
  }
}

module.exports = GoogleProvider;
