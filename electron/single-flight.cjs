// A view may disappear while a start continues. Share the native operation.
function singleFlight(operation) {
    let pending = null;
    return (...args) => {
        if (!pending) {
            pending = Promise.resolve().then(() => operation(...args)).finally(() => { pending = null; });
        }
        return pending;
    };
}

module.exports = { singleFlight };
