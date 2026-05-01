const AuthService = require('../services/auth.service');
const UserModel = require('../models/user.model');

exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  
  try {
    const { user, token } = await AuthService.registerUser({
      name,
      email,
      password,
      role
    });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Registration error detail:', err);
    res.status(err.message.includes('required') || err.message.includes('exists') ? 400 : 500).json({ message: err.message });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await AuthService.loginUser({ email, password });
    res.json(result);
  } catch (err) {
    res.status(err.message.includes('required') || err.message.includes('credentials') ? 401 : 500).json({ message: err.message });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    // req.user is set by authMiddleware
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
