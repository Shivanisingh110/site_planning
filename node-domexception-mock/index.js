// Mock implementation of node-domexception pointing to native globalThis.DOMException
const NativeDOMException = globalThis.DOMException || globalThis.Error;

module.exports = NativeDOMException;
module.exports.default = NativeDOMException;
