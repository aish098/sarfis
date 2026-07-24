const crypto = require('crypto');

exports.generateCouponId = () => {
  const num1 = Math.floor(1000 + Math.random() * 9000);
  const num2 = Math.floor(1000 + Math.random() * 9000);
  return `cop-${num1}-${num2}`;
};

exports.generateUUID = () => {
  return crypto.randomUUID();
};
