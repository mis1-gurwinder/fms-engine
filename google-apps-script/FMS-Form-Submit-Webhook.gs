/**
 * FMS Engine - Google Form submission webhook (sends the answers too)
 *
 * Install in each Google Form's LINKED RESPONSE SHEET:
 *   Sheet > Extensions > Apps Script > paste this file > Save
 *   Triggers (clock icon) > Add Trigger > onFormSubmit > From spreadsheet > On form submit
 *
 * Set the 4 values below for EACH form (one script per Google Form/stage).
 */
const FMS_ENGINE_SUBMIT_URL = 'https://fms.dinerofoodworks.com/api/form-submission';
const FMS_FORM_SECRET = 'PASTE_FORM_WEBHOOK_SECRET_FROM_RENDER';
const FMS_CODE = 'TATA-RW-01';   // FMS code shown on the FMS card
const STAGE_NO = 1;              // stage number inside that FMS

function onFormSubmit(e) {
  const named = (e && e.namedValues) || {};
  const answers = {};
  Object.keys(named).forEach(function (question) {
    answers[question] = named[question].join(', ');
  });
  const respondent = named['Email Address'] ? named['Email Address'][0] : '';
  const payload = {
    fmsCode: FMS_CODE,
    stageNo: STAGE_NO,
    respondent: respondent,
    submittedAt: new Date().toISOString(),
    answers: answers,
  };
  const res = UrlFetchApp.fetch(FMS_ENGINE_SUBMIT_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-form-secret': FMS_FORM_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}
