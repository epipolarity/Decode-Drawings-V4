// handy functions

// linear mapping of value from range fromMin->fromMax to range toMin->toMax
function map(val, fromMin, fromMax, toMin, toMax) {
    const fromRange = fromMax - fromMin;
    const toRange = toMax - toMin;
    return toMin + (toRange * (val - fromMin) / fromRange);
}


// round a number to given precision
// not a perfect implementation but just needed to get rid of some decimal places
// for file size and readability
function round(value, precision) {
    const scaler = Math.pow(10, precision);
    return Math.round(value * scaler) / scaler;
}


// convert an array of strings to a string with each element on a new line
// used for exporting XY image coords text file
function arrayToTextLines(array) {
    return array.join("\n");
}


// convert an object to a javascript module that exports that object as a constant
// used for exporting ball detection result to JS modules for dynamic import
// so we don't have to watch the video every time we tweak the algorithms
function objectToJSConst(object, name) {
    return `export const ${name} = ${JSON.stringify(object, null, 2)};`;
}


// convert a string to a blob and trigger a text file download
// borrowed heavily from https://www.tutorialspoint.com/how-to-create-and-save-text-file-in-javascript
function downloadText(content, filename, type = 'text/plain') {
    const link = document.createElement("a");
    const file = new Blob([content], { type });
    link.href = URL.createObjectURL(file);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}


// truncate text to given char limit without truncating part way through a line
function truncate(text, limit) {
    if (text.length <= limit) {
        return text;
    }
    const lastLine = text.lastIndexOf('\n', limit);
    return text.substring(0, lastLine) + '\n...';
}

export { map, round, arrayToTextLines, objectToJSConst, downloadText, truncate };