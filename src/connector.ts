import { DEVMODE } from './globals'
import { MOCKMODE } from './main'

let SERVER_LOG_ROOT = DEVMODE ? "http://127.0.0.1:5000/" : "https://tejassrinivasan.pythonanywhere.com/"

export async function load_data(): Promise<any> {
    // include timestamp so that things don't get cached
    let result = await $.getJSON(
        `baked_queues/${globalThis.uid}.json?t=${Date.now()}`,
    )
    return result
}
export async function log_data(data): Promise<any> {
    if (MOCKMODE) {
        console.log("logged (mock)", data)
        return
    }

    data["url_data"] = globalThis.url_data
    console.log("Data")
    if (!("study_id" in data['url_data'])) {
        data['url_data']["study_id"] = "trialrun_studies"
    }
    data["url_data"]["queue_id"] = globalThis.uid
    console.log("logged", data)
    console.log("Logging to", SERVER_LOG_ROOT + "log")

    try {
        let result = await $.ajax(
            SERVER_LOG_ROOT + "log",
            {
                data: JSON.stringify({
                    project: "2step-trust-study-interventions/" + data['url_data']['study_id'],
                    uid: globalThis.uid.replace("/", "_") + "_" + data['url_data']['prolific_id'],
                    payload: JSON.stringify(data),
                }),
                type: 'POST',
                contentType: 'application/json',
            }
        )
        return result
    } catch (e) {
        console.log(e)
    }
}