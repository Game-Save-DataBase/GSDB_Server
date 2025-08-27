"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textEscape = void 0;
const escapeTable = {
    '|': '\\|',
    '\\': '\\\\', // backslash itself
};
/**
 * Escape special characters for the text part
 * @param {string} text to escape
 * @returns {string}
 */
const textEscape = (text) => text
    .split('')
    .map((character) => escapeTable[character] || character).join('');
exports.textEscape = textEscape;
