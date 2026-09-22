import { API } from 'homebridge';
import { HarviaPlatform } from './HarviaPlatform.js';

export default (api: API) => {
  api.registerPlatform('homebridge-harvia', 'HarviaSauna', HarviaPlatform);
};
