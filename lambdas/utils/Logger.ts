import { getCurrentDateTime } from './DateUtility';

class Logger {
    public static appendLog(msg: string) {
        const formattedMsg: string = `[LOG] [${getCurrentDateTime()}]: ${msg}`;
        console.log(formattedMsg);
    }

    public static appendError(msg: string) {
        const formattedMsg: string = `[ERROR] [${getCurrentDateTime()}]: ${msg}`;
        console.error(formattedMsg);
    }

    public static appendDebugLog(msg: string) {
        const isDebug: boolean = process.env.DEBUG === 'true';

        if (isDebug) {
            const formattedMsg: string = `[DEBUG] [${getCurrentDateTime()}]: ${msg}`;
            console.log(formattedMsg);
        }
    }
}

export default Logger;
