const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generateClassCode = (length = 6) => {
  let code = '';

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    code += CHARSET[randomIndex];
  }

  return code;
  // code generater
};

module.exports = {
  generateClassCode
};
