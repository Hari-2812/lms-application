const dns = require('dns');
const mongoose = require('mongoose');

// The local network's DNS resolver (the router) times out on lookups for
// this Atlas cluster's hostnames. dns.setServers() redirects the c-ares-based
// resolve*() calls (used for the SRV/TXT records in mongodb+srv:// URIs) to a
// public resolver, but dns.lookup() — used by Node/the driver for the actual
// per-shard TCP connections — goes through the OS resolver via getaddrinfo()
// and ignores setServers() entirely. So both need patching, or shard
// connections keep failing with EAI_AGAIN even after the SRV lookup works.
if (dns.setServers) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const originalLookup = dns.lookup;
dns.lookup = function lookupViaResolver(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  const wantsAll = options && options.all;

  dns.resolve4(hostname, (err4, addresses4) => {
    if (!err4 && addresses4.length) {
      return callback(null, wantsAll ? addresses4.map((address) => ({ address, family: 4 })) : addresses4[0], 4);
    }
    dns.resolve6(hostname, (err6, addresses6) => {
      if (!err6 && addresses6.length) {
        return callback(null, wantsAll ? addresses6.map((address) => ({ address, family: 6 })) : addresses6[0], 6);
      }
      originalLookup(hostname, options, callback);
    });
  });
};

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_demo';

/**
 * Connection string with the password removed, for logs.
 * Printing the raw URI leaks the Atlas password into terminal history, CI
 * output and any log file the process is piped to.
 */
function redactUri(uri) {
  try {
    const parsed = new URL(uri);
    if (parsed.password) parsed.password = '****';
    return parsed.toString();
  } catch {
    return uri.replace(/\/\/[^@/]+@/, '//****@');
  }
}

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`[db] connected: ${redactUri(MONGODB_URI)}`);
  return mongoose.connection;
}

module.exports = { connectDB, MONGODB_URI, redactUri };
