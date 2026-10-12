/**
 * FMS Engine - Google Form submission webhook
 *
 * Install in the Google Form's LINKED RESPONSE SHEET:
 *   Sheet > Extensions > Apps Script > paste this file > Save
 *   Triggers (clock icon) > Add Trigger > onFormSubmit > From spreadsheet > On form submit
 *
 * Set the 3 values below for EACH form (one script per Google Form/stage).
 */
const FMS_ENGINE_SUBMIT_URL = 'https://YOUR-SERVER-DOMAIN/api/form-submission'; // must be reachable from Google
const FMS_FORM_SECRET = 'SAME_AS_FORM_WEBHOOK_SECRET_IN_server/.env';
const FMS_CODE = 'TATA-RM-INWARD'; // FMS code shown on the FMS card
const STAGE_NO = 1;                // stage number inside that FMS

function onFormSubmit(e) {
  const respondent = e && e.namedValues && e.namedValues['Email Address'] ? e.namedValues['Email Address'][0] : '';
  const payload = {
    fmsCode: FMS_CODE,
    stageNo: STAGE_NO,
    respondent: respondent,
    submittedAt: new Date().toISOString(),
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
