"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.anchor = void 0;
/**
 * Make kebap case format
*/
function anchor(input) {
    return input
        .replace(/\s+/g, '-')
        .replace(/^-*/ig, '')
        .replace(/-*$/ig, '')
        .replace(/\./g, '')
        .toLowerCase();
}
exports.anchor = anchor;
