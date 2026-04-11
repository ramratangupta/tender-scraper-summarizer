// Vitest setup file
// Setup environment variables for tests
process.env.VITE_API_URL = 'http://localhost:2900/api';

// Polyfill TextEncoder/TextDecoder for React Router
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;