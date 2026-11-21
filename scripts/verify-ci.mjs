import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// All suites use public fixtures or isolated identities/DBs. No real Provider,
// deployed account, microphone, LAN gateway, or deployment secret is required.
const suites=[
 'verify_app.mjs',
 'verify_hub.mjs',
 'verify_workflows.mjs',
 'verify_difficulty.mjs',
 'verify_school_tracks.mjs',
 'verify_exam_standards.mjs',
 'verify_learning_report.mjs',
 'verify_reviews.mjs',
 'verify_admin_contracts.mjs',
 'verify_ai_contracts.mjs',
 'verify_provider_models.mjs',
 'verify_openai_relay.mjs',
 'verify_ui_flows.mjs',
 'verify_oral_save_races.mjs',
 'verify_lan_auth_policy.mjs',
 'verify_public_assets.mjs',
 'verify_startup.mjs',
 'verify_oral_audio_ui.mjs',
 'verify_admin.mjs',
 'verify_multiuser.mjs',
 'verify_merge_features.mjs',
 'verify_ai_grading.mjs',
 'verify_ai_questions.mjs',
 'verify_study_features.mjs',
 'verify_oral_analysis.mjs',
];
const cwd=fileURLToPath(new URL('../',import.meta.url));
for(const suite of suites){
 console.log('\nRunning '+suite);
 const result=spawnSync(process.execPath,['--experimental-strip-types',fileURLToPath(new URL(suite,import.meta.url))],{cwd,stdio:'inherit',timeout:120000});
 if(result.error){console.error(suite+': '+result.error.message);process.exit(1);}
 if(result.status!==0)process.exit(result.status||1);
}
console.log('\nAll '+suites.length+' isolated regression suites passed.');
