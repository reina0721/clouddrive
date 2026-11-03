import { appI18n } from '../i18n/i18n';
import { authenticationResources } from './translations';

// Authentication copy loads with its surface; the shell owns only loading/logout copy.
appI18n.addResources(authenticationResources);
