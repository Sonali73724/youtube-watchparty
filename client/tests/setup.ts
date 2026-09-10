import '@testing-library/jest-dom';

// Mock scrollTo and scrollIntoView
window.HTMLElement.prototype.scrollIntoView = function () {};
window.scrollTo = function () {};
