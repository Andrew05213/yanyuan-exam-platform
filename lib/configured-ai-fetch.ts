import {env} from 'cloudflare:workers';
import {createAIFetch} from './upstream-fetch';
export function configuredAIFetch(){return createAIFetch({url:env.AI_OPENAI_RELAY_URL,token:env.AI_OPENAI_RELAY_TOKEN});}
