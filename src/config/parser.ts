export default {
    name: process.env.PARSER,
    maxSongs: process.env.MAX_PARSED_SONGS,
    startHour: process.env.EVERY_DAY_START_HOUR,
    startWithServer: process.env.START_WITH_SERVER,
    isStartWithServer() {
        return (/^(true|1)$/i).test(this.get('parser.startWithServer'));
    },
};
