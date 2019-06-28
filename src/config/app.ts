export default {
    nodeEnv: process.env.NODE_ENV,
    key: process.env.APP_KEY,
    port: process.env.PORT || 3000,
    logFile: process.env.LOG_FILE,
    isDev() {
        return this.get('app.nodeEnv') === 'dev';
    },
};
