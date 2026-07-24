const GoogleProvider = require('./GoogleProvider');

class AuthProviderFactory {
  static getProvider(providerName = 'GOOGLE') {
    const normalized = String(providerName).toUpperCase();
    switch (normalized) {
      case 'GOOGLE':
        return new GoogleProvider();
      default:
        throw new Error(`Unsupported authentication provider: ${providerName}`);
    }
  }
}

module.exports = AuthProviderFactory;
