import { DEVMODE } from "./globals"
export var UID: string
export var MOCKMODE: boolean = false
import { load_data, log_data } from './connector'
import { paramsToObject, startTimer } from "./utils"
//import { get_user_trust_effect, get_adjusted_ai_confidence} from "./run_user_models"

let USER_MODELS_ROOT = "https://tejassrinivasan.pythonanywhere.com/"
let user_decision_model = "user_acceptance_model-logisticregression-0.9347testf1"
let trust_effect_model = "trust_effect_model-svm_linear-0.4644testmae-0.9095testteda"

var data: any[] = []
let question_i = -1
let question: any = null
let initial_user_decision: number = -1
let final_user_decision: number = -1
let initial_user_confidence: number = -1
let final_user_confidence: number = -1
let balance = 0

let user_reported_trust_level: number = 5
let prev_user_reported_trust_level: number = -1

let bet_val_ratio: number = 1
let time_question_start: number
let time_final_decision_start: number
let time_trust_decision_start: number
let time_initial_confidence_start: number
let time_final_confidence_start: number
let instruction_i: number = 0
let count_exited_page: number = 0


let user_current_estimated_trust_level: number = 0

var all_user_interactions = []
var intervention_details = {}
var trust_effect_prediction_data = {}
let findnewconf_result: any

function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

function next_instructions(increment: number) {
    instruction_i += increment

    if (instruction_i == 0) {
        $("#button_instructions_prev").attr("disabled", "true")
    } else {
        $("#button_instructions_prev").removeAttr("disabled")
    }
    if (instruction_i >= 6) {
        $("#instructions_and_decorations").show()
        $("#button_instructions_next").val("Start study")
    } else {
        $("#instructions_and_decorations").hide()
        $("#button_instructions_next").val("Next")
    }
    if (instruction_i == 7) {
        $("#main_box_instructions").hide()
        $("#main_box_experiment").show()
        next_question()
    }

    $("#main_box_instructions").children(":not(input)").each((_, el) => {
        $(el).hide()
    })
    $(`#instructions_${instruction_i}`).show()
}
$("#button_instructions_next").on("click", () => next_instructions(+1))
$("#button_instructions_prev").on("click", () => next_instructions(-1))

$("#button_next").on("click", () => {
    if (question_i != -1) {
        let logged_data = {
            "question_i": question_i,
            "user_balance_post_interaction": balance,
            "user_trust_val_before": prev_user_reported_trust_level,
            "user_trust_val_after": user_reported_trust_level,
            "initial_user_decision": initial_user_decision,
            "final_user_decision": final_user_decision,
            "initial_user_confidence": initial_user_confidence,
            "final_user_confidence": final_user_confidence,
        }

        logged_data['times'] = {
            "initial_decision": time_initial_confidence_start - time_question_start,
            "initial_confidence": time_final_decision_start - time_initial_confidence_start,
            "final_decision": time_final_confidence_start - time_final_decision_start,
            "final_confidence": time_trust_decision_start - time_final_confidence_start,
            "trust_decision": Date.now() - time_trust_decision_start,
        }
        logged_data['question'] = question
        logged_data['count_exited_page'] = count_exited_page
        logged_data['intervention_details'] = intervention_details
        logged_data['trust_effect_prediction_data'] = trust_effect_prediction_data
        log_data(logged_data)
        count_exited_page = 0

    }
    next_question()
});

$('#range_val').on('input change', function () {
    user_reported_trust_level = ($(this).val()! as number)
    $("#range_text").text(`After this interaction, your current trust in the AI: ${user_reported_trust_level * 10} / 100.`)
    $("#button_next").show()
});

function make_initial_user_decision(option) {
    time_initial_confidence_start = Date.now()
    initial_user_decision = option
    assert(option == 1 || option == 2 || option == 3 || option == 4, "Invalid option!")

    // Remove activedecision for all buttons except the selected one
    $(`#button_initial_decision_option${option}`).attr("activedecision", "true")
    for (let i = 1; i <= 4; i++) {
        if (i != option) {
            $(`#button_initial_decision_option${i}`).removeAttr("activedecision")
        }
        $(`#button_initial_decision_option${i}`).attr("disabled", "true")
    }
    console.log("User's initial decision: Option ", option)
    
    $("#initial_user_confidence_div").show()
    $("#button_initial_confidence_option1").removeAttr("disabled")
    $("#button_initial_confidence_option2").removeAttr("disabled")
    $("#button_initial_confidence_option3").removeAttr("disabled")
}
$("#button_initial_decision_option1").on("click", () => make_initial_user_decision(1))
$("#button_initial_decision_option2").on("click", () => make_initial_user_decision(2))
$("#button_initial_decision_option3").on("click", () => make_initial_user_decision(3))
$("#button_initial_decision_option4").on("click", () => make_initial_user_decision(4))

function get_initial_user_confidence(conf_level) {
    time_final_decision_start = Date.now()
    initial_user_confidence = conf_level
    assert(conf_level == 1 || conf_level == 2 || conf_level == 3, "Invalid option!")
    // Remove activedecision for all buttons except the selected one. Disable all buttons.
    for (let i = 1; i <= 3; i++) {
        if (i != conf_level) {
            $(`#button_initial_confidence_option${i}`).removeAttr("activedecision")
        }
        $(`#button_initial_confidence_option${i}`).attr("disabled", "true")
    }
    $(`#button_initial_confidence_option${conf_level}`).attr("activedecision", "true")

    $("#button_final_decision_option1").removeAttr("disabled")
    $("#button_final_decision_option2").removeAttr("disabled")    
    $("#button_final_decision_option3").removeAttr("disabled")    
    $("#button_final_decision_option4").removeAttr("disabled")    

    get_ai_assistance()
}
$("#button_initial_confidence_option1").on("click", () => get_initial_user_confidence(1))
$("#button_initial_confidence_option2").on("click", () => get_initial_user_confidence(2))
$("#button_initial_confidence_option3").on("click", () => get_initial_user_confidence(3))



async function get_user_decision_prob() {
    // Prepare inputs for the user decision model
    let user_ai_initial_agreement = Number(initial_user_decision == question!["ai_prediction"])
    let user_initial_confidence = initial_user_confidence
    let ai_confidence = Number(question!["ai_confidence"].replace("%", "")) / 100
    let user_current_trust_level = user_current_estimated_trust_level
    if (useUserReportedTrustVal) {
        user_current_trust_level = (user_reported_trust_level - 5) / 2.5
    }
    let user_decision_model_inputs = {
        "user_ai_initial_agreement": user_ai_initial_agreement,
        "user_initial_confidence": user_initial_confidence,
        "ai_confidence": ai_confidence,
        "user_current_trust_level": user_current_trust_level,
        "timestep": question_i,
    }

    let result: any
    try {
        result = await $.ajax(
            USER_MODELS_ROOT + "get_user_decision_prob",
            {
                data: JSON.stringify({
                    project: "medical-diagnosis-study",
                    model_name: user_decision_model,
                    payload: JSON.stringify(user_decision_model_inputs),
                }),
                type: 'POST',
                contentType: 'application/json',
            }
        )
    } catch (e) {
        console.log("ERROR!")
        console.log(e)
    }
    return {
        "user_decision_model_inputs": user_decision_model_inputs, 
        "user_acceptance_likelihood": result["pred_probs"][0][1]
    }
}

async function examine_effect_of_trust_on_decision_making() {
    // Prepare input variables for user decision model
    let user_ai_initial_agreement = Number(initial_user_decision == question!["ai_prediction"])
    let user_initial_confidence = initial_user_confidence
    let ai_confidence = Number(question!["ai_confidence"].replace("%", "")) / 100
    let user_current_trust_level = user_current_estimated_trust_level
    if (useUserReportedTrustVal) {
        user_current_trust_level = (user_reported_trust_level - 5) / 2.5
    }
    let user_decision_model_inputs = {
        "user_ai_initial_agreement": user_ai_initial_agreement,
        "user_initial_confidence": user_initial_confidence,
        "ai_confidence": ai_confidence,
        "user_current_trust_level": user_current_trust_level,
        "timestep": question_i,
    }
    console.log("User decision model inputs: ", user_decision_model_inputs)

    let aldiff_result: any
    try {
        aldiff_result = await $.ajax(
            USER_MODELS_ROOT + "examine_effect_of_trust_on_decision_making",
            {
                data: JSON.stringify({
                    project: "medical-diagnosis-study",
                    model_name: user_decision_model,
                    payload: JSON.stringify(user_decision_model_inputs),
                }),
                type: 'POST',
                contentType: 'application/json',
            }
        )
    } catch (e) {
        console.log("ERROR!")
        console.log(e)
    }

    return aldiff_result
}

async function find_best_aiconf_to_display(user_acceptance_likelihood_neutral_trust) {
    // Prepare input variables for user decision model
    let user_ai_initial_agreement = Number(initial_user_decision == question!["ai_prediction"])
    let user_initial_confidence = initial_user_confidence
    let ai_confidence = Number(question!["ai_confidence"].replace("%", "")) / 100
    let user_current_trust_level = user_current_estimated_trust_level
    if (useUserReportedTrustVal) {
        user_current_trust_level = (user_reported_trust_level - 5) / 2.5
    }
    let findnewconf_input_variables = {
        "user_ai_initial_agreement": user_ai_initial_agreement,
        "user_initial_confidence": user_initial_confidence,
        "user_current_trust_level": user_current_trust_level,
        "timestep": question_i,
        "user_acceptance_likelihood_neutral_trust": user_acceptance_likelihood_neutral_trust,
    }
    try {
        findnewconf_result = await $.ajax(
            USER_MODELS_ROOT + "find_best_aiconf_to_display",
            {
                data: JSON.stringify({
                    project: "medical-diagnosis-study",
                    model_name: user_decision_model,
                    payload: JSON.stringify(findnewconf_input_variables),
                }),
                type: 'POST',
                contentType: 'application/json',
            }
        )
    } catch (e) {
        console.log("ERROR!")
        console.log(e)
    }

    return findnewconf_result
}

async function get_ai_assistance() {
    console.log("Getting AI assistance...")

    let displayed_ai_confidence = question!["ai_confidence"]
    let user_current_trust_level = user_current_estimated_trust_level
    if (useUserReportedTrustVal) {
        user_current_trust_level = (user_reported_trust_level - 5) / 2.5
        console.log("Using user reported trust value: ", user_reported_trust_level)
    }
    intervention_details = {
        "intervention_applied": false, 
        "trust_level_at_start_of_interaction": user_current_trust_level
    
    }

    if (AIInterventionType == "none" || (initial_user_decision == question!["ai_prediction"])) {
        // No intervention, just show the AI assistance that is already populated in the span
        console.log("Not applying any intervention.")
        displayed_ai_confidence = question!["ai_confidence"]
    }
    else if (AIInterventionType == "confidence_manip") {
        // Modify AI confidence

        if (
            (AIInterventionGoal == "none") || 
            (AIInterventionGoal == "mitigate_undertrust" && user_current_trust_level < InterventionTrustThreshold) ||
            (AIInterventionGoal == "mitigate_overtrust" && user_current_trust_level > InterventionTrustThreshold)
        ) {
            console.log("Applying AI confidence manipulation intervention.")
            if (AIInterventionStrategy == "fixed") {
                // Add InterventionFixedConfChange to AI's confidence
                // (InterventionFixedConfChange can be negative)
                let ai_confidence = Number(question!["ai_confidence"].replace("%", "")) / 100
                let new_confidence = Math.min(1, ai_confidence + InterventionFixedConfChange)
                new_confidence = Math.max(0.5, new_confidence)
                displayed_ai_confidence = String(( new_confidence * 100).toFixed(0)) + "%"
                let confidence_change = (new_confidence - ai_confidence).toFixed(2)
                console.log("Actual AI confidence: ", question!["ai_confidence"], ", Confidence shown to user: ", displayed_ai_confidence)

                intervention_details["conf_actual"] = question!["ai_confidence"]
                intervention_details["conf_displayed"] = displayed_ai_confidence
                intervention_details["conf_change"] = confidence_change
                intervention_details["intervention_applied"] = true
            }
            else if (AIInterventionStrategy == "adaptive") {
                // TODO: Implement adaptive strategy
            }
        } else {
            console.log("Conditions for applying 'confidence manipulation' intervention not satisfied.")
        }

    } 
    else if (AIInterventionType == "ai_explanation") {
        // Add AI explanation

        if (
            (AIInterventionGoal == "none") ||
            (AIInterventionGoal == "mitigate_undertrust" && user_current_trust_level < InterventionTrustThreshold) ||
            (AIInterventionGoal == "mitigate_overtrust" && user_current_trust_level > InterventionTrustThreshold)
        ) {
            console.log("Applying AI explanation intervention.")
            if (AIInterventionStrategy == "fixed") {
                console.log("Showing explanation")
                let explanation_shown: string = !question!["ai_explanation"] ? "No explanation provided" : question!["ai_explanation"]
                $("#ai_explanation_span").html(explanation_shown)
                $("#ai_explanation_div").show()
                
                intervention_details["explanation_shown"] = explanation_shown
                intervention_details["intervention_applied"] = true

                const ai_explanation_div = document.getElementById("ai_explanation_div")
                const buttons = [
                    document.getElementById("button_final_decision_option1"),
                    document.getElementById("button_final_decision_option2"),
                ]
                startTimer(15, ai_explanation_div, buttons, null, "Please read the explanation.")
            }
            else if (AIInterventionStrategy == "adaptive") {
                // TODO: Implement adaptive strategy
            }

        } else {
            console.log("Conditions for applying 'AI explanation' intervention not satisfied.")
        }

    }
    else if (AIInterventionType == "ai_contrastive_explanation") {
        // Add AI explanation

        if (
            (AIInterventionGoal == "none") ||
            (AIInterventionGoal == "mitigate_undertrust" && user_current_trust_level < InterventionTrustThreshold) ||
            (AIInterventionGoal == "mitigate_overtrust" && user_current_trust_level > InterventionTrustThreshold)
        ) {
            console.log("Applying AI explanation intervention.")
            if (AIInterventionStrategy == "fixed") {
                console.log("Showing explanation")
                let explanation_shown: string = !question!["ai_contrastive_explanation"] ? "No explanation provided" : question!["ai_contrastive_explanation"]
                $("#ai_contrastive_explanation_span").html(explanation_shown)
                $("#ai_contrastive_explanation_div").show()
                
                intervention_details["explanation_shown"] = explanation_shown
                intervention_details["intervention_applied"] = true

                const ai_contrastive_explanation_div = document.getElementById("ai_contrastive_explanation_div")
                const buttons = [
                    document.getElementById("button_final_decision_option1"),
                    document.getElementById("button_final_decision_option2"),
                ]
                startTimer(10, ai_contrastive_explanation_div, buttons, null, "Please read the explanation.")
            }
            else if (AIInterventionStrategy == "adaptive") {
                // TODO: Implement adaptive strategy
            }

        } else {
            console.log("Conditions for applying 'AI explanation' intervention not satisfied.")
        }

    }


    //intervention_details['actual_ai_confidence'] = question!["ai_confidence"]
    //intervention_details['displayed_ai_confidence'] = displayed_ai_confidence
    console.log("AI Assistance Intervention Details: ", intervention_details)

    $("#ai_prediction_span").html("Option " + question!["ai_prediction"])
    $("#ai_confidence_span").html(displayed_ai_confidence)

    $("#ai_assistance_div").show()
    $("#final_user_decision_div").show()
}

async function get_trust_effect() {
    // Get trust effect for this interaction
    let initial_user_correctness = Number(initial_user_decision == question!["correct_option"])
    let ai_correctness = Number(question!["ai_prediction"] == question!["correct_option"])
    let final_user_correctness = Number(final_user_decision == question!["correct_option"])
    let ai_confidence = Number(question!["ai_confidence"].replace("%", "")) / 100
    let trust_effect_inputs = {
        "initial_user_correctness": initial_user_correctness,
        "ai_correctness": ai_correctness,
        "final_user_correctness": final_user_correctness,
        "ai_confidence": ai_confidence,
        "user_current_trust_level": user_current_estimated_trust_level,
        "timestep": question_i,
    }
    console.log("Trust effect inputs: ", trust_effect_inputs)
    //let trust_effect = get_user_trust_effect(trust_effect_inputs)
    let result: any
    try {
        result = await $.ajax(
            USER_MODELS_ROOT + "get_trust_effect",
            {
                data: JSON.stringify({
                    project: "medical-diagnosis-study",
                    model_name: trust_effect_model,
                    payload: JSON.stringify(trust_effect_inputs),
                }),
                type: 'POST',
                contentType: 'application/json',
            }
        )
    } catch (e) {
        console.log("ERROR!")
        console.log(e)
    }

    console.log("Trust effect prediction result: ", result)
    let trust_effect = await result["trust_effect"]

    user_current_estimated_trust_level = user_current_estimated_trust_level + trust_effect
    trust_effect_prediction_data = {
        "model_inputs": trust_effect_inputs,
        "predicted_trust_effect": trust_effect,
        "user_new_trust_level": user_current_estimated_trust_level,
    }
    return trust_effect_prediction_data
}

function make_final_user_decision(option) {
    time_final_confidence_start = Date.now()
    final_user_decision = option
    assert(option == 1 || option == 2 || option == 3 || option == 4, "Invalid option!")

    // Remove activedecision for all buttons except the selected one
    for (let i = 1; i <= 4; i++) {
        if (i != option) {
            $(`#button_final_decision_option${i}`).removeAttr("activedecision")
        }
        $(`#button_final_decision_option${i}`).attr("disabled", "true")
    }
    $(`#button_final_decision_option${option}`).attr("activedecision", "true")

    $("#final_user_confidence_div").show()
    $("#button_final_confidence_option1").removeAttr("disabled")
    $("#button_final_confidence_option2").removeAttr("disabled")
    $("#button_final_confidence_option3").removeAttr("disabled")
}
$("#button_final_decision_option1").on("click", () => make_final_user_decision(1))
$("#button_final_decision_option2").on("click", () => make_final_user_decision(2))
$("#button_final_decision_option3").on("click", () => make_final_user_decision(3))
$("#button_final_decision_option4").on("click", () => make_final_user_decision(4))

function get_final_user_confidence(conf_level) {
    time_trust_decision_start = Date.now()
    final_user_confidence = conf_level
    assert(conf_level == 1 || conf_level == 2 || conf_level == 3, "Invalid option!")
    // Remove activedecision for all buttons except the selected one
    for (let i = 1; i <= 3; i++) {
        if (i != conf_level) {
            $(`#button_final_confidence_option${i}`).removeAttr("activedecision")
        }
        $(`#button_final_confidence_option${i}`).attr("disabled", "true")
    }
    $(`#button_final_confidence_option${conf_level}`).attr("activedecision", "true")

    show_result()
}
$("#button_final_confidence_option1").on("click", () => get_final_user_confidence(1))
$("#button_final_confidence_option2").on("click", () => get_final_user_confidence(2))
$("#button_final_confidence_option3").on("click", () => get_final_user_confidence(3))


async function show_result() {

    let correct_option: number = question!["correct_option"]
    let correct_option_str: string = question![`option${correct_option}`]
    let user_is_correct: boolean = correct_option == final_user_decision

    let ai_is_correct: boolean = question!["ai_is_correct"]
    let message = "Correct answer: <b>Option " + correct_option + ": " + correct_option_str + "</b>.<br>"
    if (user_is_correct) {
        message += "You picked Option " + final_user_decision + ", which was <span class='color_correct'><b>correct</b></span>.<br>"
    }
    else {
        message += "You picked Option " + final_user_decision + ", which was <span class='color_incorrect'><b>incorrect</b></span>.<br>"
    }
    if (ai_is_correct) {
        message += "The AI picked Option " + question!["ai_prediction"] + ", which was <span class='color_correct'><b>correct<b></span>.<br>"
    }
    else {
        message += "The AI picked Option " + question!["ai_prediction"] + ", which was <span class='color_incorrect'><b>incorrect</b></span>.<br>"
    }
    if (user_is_correct) {
        message += "<span class='color_correct'><b>You receive a reward of $0.10.</b></span>"
        balance += 0.1
    }
    else {
        message += "<span class='color_incorrect'><b>You do not receive any reward.</b></span>"
    }

    message += "<br>"
    //if (success) {
    //    message += `You gain $${(bet_val*bet_val_ratio).toFixed(2)}.`
    //    balance += bet_val*bet_val_ratio
    //} else {
    //    message += `You lose $${(bet_val/1.0).toFixed(2)}.`
    //    balance -= bet_val/1.0
    //    balance = Math.max(0, balance)
    //}
    $("#balance").text(`Balance: $${balance.toFixed(2)} + $2.0`)
    $("#result_span").html(message)
    //$("#button_next").show()
    $("#result_span").show()
    //$("#button_place_bet").hide()
    if (skip_trust_reporting)   {
        $("#button_next").show()
    }
    else {
        $("#user_trust_report_div").show()
    }

    //trust_effect_prediction_data = await get_trust_effect()

    //$('#range_val').attr("disabled", "true")
}

//$("#button_place_bet").on("click", show_result)

function start_timer_for_initial_decision() {
    const initial_user_decision_div = document.getElementById("initial_user_decision_div")
    const buttons = [
        document.getElementById("button_initial_decision_option1"),
        document.getElementById("button_initial_decision_option2"),
        document.getElementById("button_initial_decision_option3"),
        document.getElementById("button_initial_decision_option4"),
    ]
    startTimer(10, initial_user_decision_div, buttons, null, "Please read the symptoms and options closely.")
}


function next_question() {
    // restore previous state of UI
    for (let i = 1; i <= 4; i++) {
        $(`#button_initial_decision_option${i}`).removeAttr("activedecision")
        $(`#button_initial_decision_option${i}`).removeAttr("disabled")
        $(`#button_final_decision_option${i}`).removeAttr("activedecision")
        $(`#button_final_decision_option${i}`).removeAttr("disabled")
    }

    for (let i = 1; i <= 3; i++) {
        $(`#button_initial_confidence_option${i}`).removeAttr("activedecision")
        $(`#button_initial_confidence_option${i}`).removeAttr("disabled")
        $(`#button_final_confidence_option${i}`).removeAttr("activedecision")
        $(`#button_final_confidence_option${i}`).removeAttr("disabled")
    }

    $("#ai_assistance_div").hide()
    $("#ai_explanation_div").hide()
    $("#ai_contrastive_explanation_div").hide()
    $("#initial_user_confidence_div").hide()
    $("#final_user_decision_div").hide()
    $("#final_user_confidence_div").hide()
    $('#range_val').removeAttr("disabled")
    $("#user_trust_report_div").hide()
    $("#button_place_bet").hide()
    $("#button_next").hide()
    $("#result_span").hide()
    if (question_i == -1) {
        $("#range_text").text("-")
    }
    else {
        $("#range_text").text(`Before this interaction, your trust in the AI: ${user_reported_trust_level * 10} / 100.`)
    }
    $("#range_val").val(user_reported_trust_level)
    prev_user_reported_trust_level = user_reported_trust_level

    question_i += 1
    if (question_i >= data.length) {
        $("#main_box_experiment").hide()
        if (MOCKMODE) {
            $("#main_box_end_mock").show()
        } else {
            $("#main_box_end").show()
        }
        return
    }
    question = data[question_i]

    $("#question_span").html(question!["question"])
    $("#option1_span").html(question!["option1"])
    $("#option2_span").html(question!["option2"])
    $("#option3_span").html(question!["option3"])
    $("#option4_span").html(question!["option4"])
    //$("#ai_prediction_span").html("Option " + question!["ai_prediction"])
    //$("#ai_confidence_span").html(question!["ai_confidence"])

    // set bet value ratio
    if(question.hasOwnProperty("reward_ratio")) {
        let [ratio1, ratio2] = question["reward_ratio"]
        ratio1 = Number(ratio1)
        ratio2 = Number(ratio2)
        bet_val_ratio = ratio1/ratio2
    } else {
        bet_val_ratio = 1
    }

    time_question_start = Date.now()
    $("#progress").text(`Progress: ${question_i + 1} / ${data.length}`)

    start_timer_for_initial_decision()
}

// get user id and load queue
// try to see if start override was passed
const urlParams = new URLSearchParams(window.location.search);
const startOverride = urlParams.get('start');
const UIDFromURL = urlParams.get("uid")
globalThis.url_data = paramsToObject(urlParams.entries())

if (UIDFromURL != null) {
    globalThis.uid = UIDFromURL as string
    if (globalThis.uid == "prolific_random") {
        let queue_id = `${Math.floor(Math.random() * 10)}`.padStart(3, "0")
        globalThis.uid = `${urlParams.get("prolific_queue_name")}/${queue_id}`
    }
} else if (DEVMODE) {
    globalThis.uid = "demo"
} else {
    let UID_maybe: any = null
    while (UID_maybe == null) {
        UID_maybe = prompt("Enter your user id. Please get in touch if you were not assigned an id but wish to participate in this experiment.")
    }
    globalThis.uid = UID_maybe!
}


let intervention_allowed_timesteps: number[] = []
if (globalThis.uid.includes("343")) {
    intervention_allowed_timesteps = [7, 8, 9, 17, 18, 19, 27, 28, 29]
} else if (globalThis.uid.includes("434")) {
    intervention_allowed_timesteps = [7, 8, 9, 17, 18, 19, 27, 28, 29]
} else if (globalThis.uid.includes("735")) {
    intervention_allowed_timesteps = [10, 11, 12, 13, 14, 25, 26, 27, 28, 29]
}

//const validAIInterventions = ["none", "dummy", "confidence_inflation", "confidence_inflation_fixed", "confidence_deflation"]
//let AIInterventionType = urlParams.get("intervention_type")
//let InterventionALDiffThreshold = Number(urlParams.get("intervention_threshold"))
//let InterventionFixedConfIncrease = Number(urlParams.get("intervention_fixedconfincrease"))
const validInterventionGoals = ["none", "mitigate_undertrust", "mitigate_overtrust"]
let AIInterventionGoal = urlParams.get("intervention_goal")
if (AIInterventionGoal == null) {AIInterventionGoal = "none"}
if (!validInterventionGoals.includes(AIInterventionGoal!)) {
    throw new Error("Invalid AI Assistance Intervention Goal: " + AIInterventionGoal)
}

const validInterventionTypes = ["none", "dummy", "confidence_manip", "ai_explanation", "ai_contrastive_explanation"]
let AIInterventionType = urlParams.get("intervention_type")
if (AIInterventionType == null) {AIInterventionType = "none"} 
if (!validInterventionTypes.includes(AIInterventionType!)) {
    throw new Error("Invalid AI Assistance Intervention: " + AIInterventionType)
}

const validInterventionStrategies = ["dummy", "fixed", "adaptive"]
let AIInterventionStrategy = urlParams.get("intervention_strategy")
if (AIInterventionStrategy == null) {AIInterventionStrategy = "dummy"}
if (!validInterventionStrategies.includes(AIInterventionStrategy!)) {
    throw new Error("Invalid AI Assistance Intervention Strategy: " + AIInterventionStrategy)
}

// Intervention-specific parameters
let InterventionALDiffThreshold = Number(urlParams.get("intervention_threshold"))
if (InterventionALDiffThreshold == null) {InterventionALDiffThreshold = -1}
let InterventionTrustThreshold = Number(urlParams.get("intervention_trust_threshold"))
if (InterventionTrustThreshold == null) {InterventionTrustThreshold = 0}
let InterventionFixedConfChange = Number(urlParams.get("intervention_fixedconfchange"))
if (InterventionFixedConfChange == null) {InterventionFixedConfChange = 0}

let useUserReportedTrustVal = urlParams.get("use_user_reported_trust_level") == "true"
if (useUserReportedTrustVal == null) {useUserReportedTrustVal = false}

let skip_trust_reporting = urlParams.get("skip_trust_reporting") == "true"
if (skip_trust_reporting == null) {skip_trust_reporting = false}

console.log("AIInterventionGoal: ", AIInterventionGoal)
console.log("AIInterventionType: ", AIInterventionType)
console.log("AIInterventionStrategy: ", AIInterventionStrategy)
console.log("InterventionALDiffThreshold: ", InterventionALDiffThreshold)
console.log("InterventionTrustThreshold: ", InterventionTrustThreshold)
console.log("InterventionFixedConfChange: ", InterventionFixedConfChange)
console.log("useUserReportedTrustVal: ", useUserReportedTrustVal)
console.log("skip_trust_reporting: ", skip_trust_reporting)

if (AIInterventionGoal == "mitigate_undertrust") {
    assert(InterventionTrustThreshold <= 0, "Trust threshold for mitigating undertrust cannot be positive.")
    assert(InterventionFixedConfChange >= 0, "Confidence change for mitigating undertrust cannot be negative.")
} else if (AIInterventionGoal == "mitigate_overtrust") {
    assert(InterventionTrustThreshold >= 0, "Trust threshold for mitigating overtrust cannot be negative.")
    assert(InterventionFixedConfChange <= 0, "Confidence change for mitigating overtrust cannot be positive.")
}

globalThis.url_data["intervention_goal"] = AIInterventionGoal
globalThis.url_data["intervention_type"] = AIInterventionType
globalThis.url_data["intervention_strategy"] = AIInterventionStrategy
globalThis.url_data["intervention_threshold"] = InterventionALDiffThreshold
globalThis.url_data["intervention_fixedconfchange"] = InterventionFixedConfChange
globalThis.url_data["use_user_reported_trust_level"] = useUserReportedTrustVal

// version for paper
if (globalThis.uid.startsWith("demo_paper")) {
    MOCKMODE = true
} else {

}
console.log("Running with UID", globalThis.uid)
load_data().catch((_error) => {
    //alert("Invalid user id.")
    console.log("Invalid user id.")
    console.log(globalThis.uid!)
    window.location.reload()
}
).then((new_data) => {
    data = new_data
    if (startOverride != null) {
        question_i = parseInt(startOverride) - 1
        console.log("Starting from", question_i)
    }
    // next_question()
    next_instructions(0)
    $("#main_box_instructions").show()
    $("#instructions_and_decorations").hide()
})

console.log("Starting session with UID:", globalThis.uid!)

let alert_active = false
document.onvisibilitychange = () => {
    if (!alert_active) {
        count_exited_page += 1
        alert_active = true
        if (!(globalThis.uid!.startsWith("demo")) && !(DEVMODE)) {
            alert("Please don't leave the page. If you do so again, we may restrict paying you.")
        }
        alert_active = false
    }
}