import { DEVMODE } from "./globals"
export var UID: string
export var MOCKMODE: boolean = false
import { load_data, log_data } from './connector'
import { paramsToObject } from "./utils"
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
var ai_assistance_intervention_data = {}
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
            "user_trust_val": user_reported_trust_level,
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
        logged_data['ai_assistance_intervention_data'] = ai_assistance_intervention_data
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
    assert(option == 1 || option == 2, "Invalid option!")
    if (option == 1) {
        $("#button_initial_decision_option1").attr("activedecision", "true")
        $("#button_initial_decision_option2").removeAttr("activedecision")
    } else {
        $("#button_initial_decision_option1").removeAttr("activedecision")
        $("#button_initial_decision_option2").attr("activedecision", "true")
    }
    $("#initial_user_confidence_div").show()
    $("#button_initial_decision_option1").attr("disabled", "true")
    $("#button_initial_decision_option2").attr("disabled", "true")
    $("#button_initial_confidence_option1").removeAttr("disabled")
    $("#button_initial_confidence_option2").removeAttr("disabled")
    $("#button_initial_confidence_option3").removeAttr("disabled")
}
$("#button_initial_decision_option1").on("click", () => make_initial_user_decision(1))
$("#button_initial_decision_option2").on("click", () => make_initial_user_decision(2))

function get_initial_user_confidence(conf_level) {
    time_final_decision_start = Date.now()
    initial_user_confidence = conf_level
    assert(conf_level == 1 || conf_level == 2 || conf_level == 3, "Invalid option!")
    if (conf_level == 1) {
        $("#button_initial_confidence_option1").attr("activedecision", "true")
        $("#button_initial_confidence_option2").removeAttr("activedecision")
        $("#button_initial_confidence_option3").removeAttr("activedecision")
    } else if (conf_level == 2) {
        $("#button_initial_confidence_option1").removeAttr("activedecision")
        $("#button_initial_confidence_option2").attr("activedecision", "true")
        $("#button_initial_confidence_option3").removeAttr("activedecision")
    } else {
        $("#button_initial_confidence_option1").removeAttr("activedecision")
        $("#button_initial_confidence_option2").removeAttr("activedecision")
        $("#button_initial_confidence_option3").attr("activedecision", "true")
    }

    $("#button_initial_confidence_option1").attr("disabled", "true")
    $("#button_initial_confidence_option2").attr("disabled", "true")
    $("#button_initial_confidence_option3").attr("disabled", "true")
    $("#button_final_decision_option1").removeAttr("disabled")
    $("#button_final_decision_option2").removeAttr("disabled")    

    get_ai_assistance()
}
$("#button_initial_confidence_option1").on("click", () => get_initial_user_confidence(1))
$("#button_initial_confidence_option2").on("click", () => get_initial_user_confidence(2))
$("#button_initial_confidence_option3").on("click", () => get_initial_user_confidence(3))

async function get_ai_assistance() {
    console.log("Getting AI assistance...")

    let displayed_ai_confidence = "AI is figuring out its confidence..."
    let user_current_trust_level = user_current_estimated_trust_level
    if (useUserReportedTrustVal) {
        user_current_trust_level = (user_reported_trust_level - 5) / 2.5
        console.log("Using user reported trust value: ", user_reported_trust_level)
    }

    if (AIInterventionType == "none") {
        // No intervention, just show the AI assistance that is already populated in the span
        displayed_ai_confidence = question!["ai_confidence"]

    } else if (AIInterventionType == "dummy") {
        // Prepare input variables for user decision model
        let user_ai_initial_agreement = Number(initial_user_decision == question!["ai_prediction"])
        let user_initial_confidence = initial_user_confidence
        let ai_confidence = Number(question!["ai_confidence"].replace("%", "")) / 100
        let user_decision_model_inputs = {
            "user_ai_initial_agreement": user_ai_initial_agreement,
            "user_initial_confidence": user_initial_confidence,
            "ai_confidence": ai_confidence,
            "user_current_trust_level": user_current_trust_level,
            "timestep": question_i,
        }
        console.log("User decision model inputs: ", user_decision_model_inputs)

        let result: any
        try {
            result = await $.ajax(
                USER_MODELS_ROOT + "get_user_decision_prob",
                {
                    data: JSON.stringify({
                        project: "2step-trust-study",
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
        let user_decision_pred_probs = result["pred_probs"][0]
        let X = result["X"]
        console.log("User decision model X: ", X)
        console.log("User's likelihood of going with the AI's prediction: ", user_decision_pred_probs[1])
        
        displayed_ai_confidence = String(((X[2] + 0.1) * 100).toFixed(0)) + "%"  // Confidence in AI's prediction
        intervention_details = {
            "user_decision_model_inputs": user_decision_model_inputs,
            "acceptance_likelihood": user_decision_pred_probs[1],
        }
    } else if (AIInterventionType == "confidence_inflation") {
        if (user_current_trust_level < 0) {
            // Prepare input variables for user decision model
            let user_ai_initial_agreement = Number(initial_user_decision == question!["ai_prediction"])
            let user_initial_confidence = initial_user_confidence
            let ai_confidence = Number(question!["ai_confidence"].replace("%", "")) / 100
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
                            project: "2step-trust-study",
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
            
            let al_diff = aldiff_result["al_diff"]
            //console.log("Results: ", aldiff_result)
            console.log("User's likelihood of going with the AI's prediction: ", aldiff_result["actual_trust"]["acceptance_likelihood"])
            console.log("User's likelihood of going with the AI's prediction with neutral trust: ", aldiff_result["neutral_trust"]["acceptance_likelihood"])
            console.log("Acceptance Likelihood Diff: ", al_diff)
            let user_acceptance_likelihood_neutral_trust = aldiff_result["neutral_trust"]["acceptance_likelihood"]

            let intervention_applied = false
            if (al_diff > InterventionALDiffThreshold) {
                intervention_applied = true
                //Find nearest AI confidence with minimizing ALDiff
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
                                project: "2step-trust-study",
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
                displayed_ai_confidence = String((findnewconf_result['new_conf_to_display'] * 100).toFixed(0)) + "%"  // Confidence in AI's prediction
                intervention_details = {
                    "acceptance_likelihood_results": aldiff_result,
                    "findnewconf_results": findnewconf_result,
                    "current_trust_level": user_current_trust_level,
                    "conf_actual": question!["ai_confidence"],
                    "conf_new": displayed_ai_confidence,
                    "acceptance_likelihood-actualconf_actualtrust": aldiff_result["actual_trust"]["acceptance_likelihood"],
                    "acceptance_likelihood-actualconf_neutraltrust": aldiff_result["neutral_trust"]["acceptance_likelihood"],
                    "acceptance_likelihood-newconf_actualtrust": findnewconf_result["new_conf_acceptance_likelihood"],
                    "intervention_applied": true,
                }
            }
            else {
                displayed_ai_confidence = question!["ai_confidence"]
                intervention_applied = false
                intervention_details = {
                    "acceptance_likelihood_results": aldiff_result,
                    "current_trust_level": user_current_trust_level,
                    "conf_actual": question!["ai_confidence"],
                    "acceptance_likelihood-actualconf_actualtrust": aldiff_result["actual_trust"]["acceptance_likelihood"],
                    "acceptance_likelihood-actualconf_neutraltrust": aldiff_result["neutral_trust"]["acceptance_likelihood"],
                    "intervention_applied": false,
                }
            }
            
        } else {
            displayed_ai_confidence = question!["ai_confidence"]
            intervention_details = {"intervention_applied": false}
        }
    } else if (AIInterventionType == "confidence_inflation_fixed") {
        if (user_current_trust_level < 0 && initial_user_decision != question!["ai_prediction"]) {
            // Prepare input variables for user decision model
            let user_ai_initial_agreement = Number(initial_user_decision == question!["ai_prediction"])
            let user_initial_confidence = initial_user_confidence
            let ai_confidence = Number(question!["ai_confidence"].replace("%", "")) / 100
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
                            project: "2step-trust-study",
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
            
            let al_diff = aldiff_result["al_diff"]
            //console.log("Results: ", aldiff_result)
            console.log("User's likelihood of going with the AI's prediction: ", aldiff_result["actual_trust"]["acceptance_likelihood"])
            console.log("User's likelihood of going with the AI's prediction with neutral trust: ", aldiff_result["neutral_trust"]["acceptance_likelihood"])
            console.log("Acceptance Likelihood Diff: ", al_diff)
            let user_acceptance_likelihood_neutral_trust = aldiff_result["neutral_trust"]["acceptance_likelihood"]
            let new_confidence = Math.min(1, ai_confidence + InterventionFixedConfIncrease)
            displayed_ai_confidence = String(( new_confidence * 100).toFixed(0)) + "%"
            let intervention_applied = false
            intervention_details = {
                "acceptance_likelihood_results": aldiff_result,
                "current_trust_level": user_current_trust_level,
                "conf_actual": question!["ai_confidence"],
                "acceptance_likelihood-actualconf_actualtrust": aldiff_result["actual_trust"]["acceptance_likelihood"],
                "acceptance_likelihood-actualconf_neutraltrust": aldiff_result["neutral_trust"]["acceptance_likelihood"],
                "intervention_applied": true,
            }
            
        } else {
                displayed_ai_confidence = question!["ai_confidence"]
                intervention_details = {"intervention_applied": false}
        }
    } else if (AIInterventionType == "confidence_deflation") {
        if (user_current_trust_level > 0) {
            // Prepare input variables for user decision model
            let user_ai_initial_agreement = Number(initial_user_decision == question!["ai_prediction"])
            let user_initial_confidence = initial_user_confidence
            let ai_confidence = Number(question!["ai_confidence"].replace("%", "")) / 100
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
                            project: "2step-trust-study",
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
            
            let al_diff = aldiff_result["al_diff"]
            //console.log("Results: ", aldiff_result)
            console.log("User's likelihood of going with the AI's prediction: ", aldiff_result["actual_trust"]["acceptance_likelihood"])
            console.log("User's likelihood of going with the AI's prediction with neutral trust: ", aldiff_result["neutral_trust"]["acceptance_likelihood"])
            console.log("Acceptance Likelihood Diff: ", al_diff)
            let user_acceptance_likelihood_neutral_trust = aldiff_result["neutral_trust"]["acceptance_likelihood"]

            let intervention_applied = false
            if (al_diff > InterventionALDiffThreshold) {
                intervention_applied = true
                //Find nearest AI confidence with minimizing ALDiff
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
                                project: "2step-trust-study",
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
                displayed_ai_confidence = String((findnewconf_result['new_conf_to_display'] * 100).toFixed(0)) + "%"  // Confidence in AI's prediction
                intervention_details = {
                    "acceptance_likelihood_results": aldiff_result,
                    "findnewconf_results": findnewconf_result,
                    "current_trust_level": user_current_trust_level,
                    "conf_actual": question!["ai_confidence"],
                    "conf_new": displayed_ai_confidence,
                    "acceptance_likelihood-actualconf_actualtrust": aldiff_result["actual_trust"]["acceptance_likelihood"],
                    "acceptance_likelihood-actualconf_neutraltrust": aldiff_result["neutral_trust"]["acceptance_likelihood"],
                    "acceptance_likelihood-newconf_actualtrust": findnewconf_result["new_conf_acceptance_likelihood"],
                    "intervention_applied": true,
                }
            }
            else {
                displayed_ai_confidence = question!["ai_confidence"]
                intervention_applied = false
                intervention_details = {
                    "acceptance_likelihood_results": aldiff_result,
                    "current_trust_level": user_current_trust_level,
                    "conf_actual": question!["ai_confidence"],
                    "acceptance_likelihood-actualconf_actualtrust": aldiff_result["actual_trust"]["acceptance_likelihood"],
                    "acceptance_likelihood-actualconf_neutraltrust": aldiff_result["neutral_trust"]["acceptance_likelihood"],
                    "intervention_applied": false,
                }
            }            
        } else {
            displayed_ai_confidence = question!["ai_confidence"]
            intervention_details = {"intervention_applied": false}
        }
    }

    intervention_details['trust_level_at_start_of_interaction'] = user_current_trust_level
    ai_assistance_intervention_data = {
        "intervention_type": AIInterventionType,
        "actual_ai_confidence": question!["ai_confidence"],
        "displayed_ai_confidence": displayed_ai_confidence,
        "intervention_details": intervention_details,
    }
    console.log("AI Assistance Intervention Data: ", ai_assistance_intervention_data)

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
                    project: "2step-trust-study",
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

}

function make_final_user_decision(option) {
    time_final_confidence_start = Date.now()
    final_user_decision = option
    assert(option == 1 || option == 2, "Invalid option!")
    if (option == 1) {
        $("#button_final_decision_option1").attr("activedecision", "true")
        $("#button_final_decision_option2").removeAttr("activedecision")
    } else {
        $("#button_final_decision_option1").removeAttr("activedecision")
        $("#button_final_decision_option2").attr("activedecision", "true")
    }
    $("#final_user_confidence_div").show()
    $("#button_final_decision_option1").attr("disabled", "true")
    $("#button_final_decision_option2").attr("disabled", "true")
    $("#button_final_confidence_option1").removeAttr("disabled")
    $("#button_final_confidence_option2").removeAttr("disabled")
    $("#button_final_confidence_option3").removeAttr("disabled")
}
$("#button_final_decision_option1").on("click", () => make_final_user_decision(1))
$("#button_final_decision_option2").on("click", () => make_final_user_decision(2))

function get_final_user_confidence(conf_level) {
    time_trust_decision_start = Date.now()
    final_user_confidence = conf_level
    assert(conf_level == 1 || conf_level == 2 || conf_level == 3, "Invalid option!")
    if (conf_level == 1) {
        $("#button_final_confidence_option1").attr("activedecision", "true")
        $("#button_final_confidence_option2").removeAttr("activedecision")
        $("#button_final_confidence_option3").removeAttr("activedecision")
    } else if (conf_level == 2) {
        $("#button_final_confidence_option1").removeAttr("activedecision")
        $("#button_final_confidence_option2").attr("activedecision", "true")
        $("#button_final_confidence_option3").removeAttr("activedecision")
    } else {
        $("#button_final_confidence_option1").removeAttr("activedecision")
        $("#button_final_confidence_option2").removeAttr("activedecision")
        $("#button_final_confidence_option3").attr("activedecision", "true")
    }

    $("#button_final_confidence_option1").attr("disabled", "true")
    $("#button_final_confidence_option2").attr("disabled", "true")
    $("#button_final_confidence_option3").attr("disabled", "true")
    show_result()
}
$("#button_final_confidence_option1").on("click", () => get_final_user_confidence(1))
$("#button_final_confidence_option2").on("click", () => get_final_user_confidence(2))
$("#button_final_confidence_option3").on("click", () => get_final_user_confidence(3))


function show_result() {

    let correct_option: number = question!["correct_option"]
    let user_is_correct: boolean = correct_option == final_user_decision

    let ai_is_correct: boolean = question!["ai_is_correct"]
    let message = "Correct answer: <b>Option " + correct_option + "</b>.<br>"
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
    get_trust_effect()

    $("#balance").text(`Balance: $${balance.toFixed(2)} + $1.0`)
    $("#result_span").html(message)
    //$("#button_next").show()
    $("#result_span").show()
    //$("#button_place_bet").hide()
    $("#how_confident_div").show()

    //$('#range_val').attr("disabled", "true")
}

//$("#button_place_bet").on("click", show_result)

function next_question() {
    // restore previous state of UI
    $("#button_initial_decision_option1").removeAttr("activedecision")
    $("#button_initial_decision_option2").removeAttr("activedecision")
    $("#button_initial_decision_option1").removeAttr("disabled")
    $("#button_initial_decision_option2").removeAttr("disabled")

    $("#button_initial_confidence_option1").removeAttr("activedecision")
    $("#button_initial_confidence_option2").removeAttr("activedecision")
    $("#button_initial_confidence_option3").removeAttr("activedecision")
    $("#button_initial_confidence_option1").removeAttr("disabled")
    $("#button_initial_confidence_option2").removeAttr("disabled")
    $("#button_initial_confidence_option3").removeAttr("disabled")

    $("#button_final_decision_option1").removeAttr("activedecision")
    $("#button_final_decision_option2").removeAttr("activedecision")
    $("#button_final_decision_option1").removeAttr("disabled")
    $("#button_final_decision_option2").removeAttr("disabled")

    $("#button_final_confidence_option1").removeAttr("activedecision")
    $("#button_final_confidence_option2").removeAttr("activedecision")
    $("#button_final_confidence_option3").removeAttr("activedecision")
    $("#button_final_confidence_option1").removeAttr("disabled")
    $("#button_final_confidence_option2").removeAttr("disabled")
    $("#button_final_confidence_option3").removeAttr("disabled")

    $("#ai_assistance_div").hide()
    $("#initial_user_confidence_div").hide()
    $("#final_user_decision_div").hide()
    $("#final_user_confidence_div").hide()
    $('#range_val').removeAttr("disabled")
    $("#how_confident_div").hide()
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

const validAIInterventions = ["none", "dummy", "confidence_inflation", "confidence_inflation_fixed", "confidence_deflation"]
let AIInterventionType = urlParams.get("intervention_type")
let InterventionALDiffThreshold = Number(urlParams.get("intervention_threshold"))
let InterventionFixedConfIncrease = Number(urlParams.get("intervention_fixedconfincrease"))
let useUserReportedTrustVal = urlParams.get("use_user_reported_trust_level") == "true"
if (AIInterventionType == null) {
    AIInterventionType = "none"
} 
if (InterventionALDiffThreshold == null) {
    InterventionALDiffThreshold = -1
}
if (InterventionFixedConfIncrease == null) {
    InterventionFixedConfIncrease = 0
}
if (useUserReportedTrustVal == null) {
    useUserReportedTrustVal = false
}

//Assert that the AIAssistanceIntervention is one of the valid values
if (!validAIInterventions.includes(AIInterventionType!)) {
    throw new Error("Invalid AI Assistance Intervention: " + AIInterventionType)
}
globalThis.url_data["intervention_type"] = AIInterventionType
globalThis.url_data["intervention_threshold"] = InterventionALDiffThreshold

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