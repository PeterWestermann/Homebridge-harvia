import { API } from 'homebridge';
import { HarviaPlatform } from './HarviaPlatform.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

export default (api: API) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, HarviaPlatform);
};
