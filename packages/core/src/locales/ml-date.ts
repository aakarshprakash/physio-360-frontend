import type { Locale } from 'date-fns';
import { enIN } from 'date-fns/locale';

/*
 * date-fns ships no Malayalam locale. This one reuses en-IN for everything
 * except month and weekday names (CLDR "ml"). Day periods stay AM/PM, which
 * is what clinics in Kerala print on appointment slips.
 */

const months = {
  narrow: ['ജ', 'ഫെ', 'മാ', 'ഏ', 'മെ', 'ജൂൺ', 'ജൂ', 'ഓ', 'സെ', 'ഒ', 'ന', 'ഡി'],
  abbreviated: ['ജനു', 'ഫെബ്രു', 'മാർ', 'ഏപ്രി', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗ', 'സെപ്റ്റം', 'ഒക്ടോ', 'നവം', 'ഡിസം'],
  wide: ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'],
};

const days = {
  narrow: ['ഞ', 'തി', 'ചൊ', 'ബു', 'വ്യാ', 'വെ', 'ശ'],
  short: ['ഞാ', 'തി', 'ചൊ', 'ബു', 'വ്യാ', 'വെ', 'ശ'],
  abbreviated: ['ഞായർ', 'തിങ്കൾ', 'ചൊവ്വ', 'ബുധൻ', 'വ്യാഴം', 'വെള്ളി', 'ശനി'],
  wide: ['ഞായറാഴ്ച', 'തിങ്കളാഴ്ച', 'ചൊവ്വാഴ്ച', 'ബുധനാഴ്ച', 'വ്യാഴാഴ്ച', 'വെള്ളിയാഴ്ച', 'ശനിയാഴ്ച'],
};

type Width = 'narrow' | 'short' | 'abbreviated' | 'wide';

export const ml: Locale = {
  ...enIN,
  code: 'ml',
  localize: {
    ...enIN.localize,
    month: (index, options) => {
      const width = options?.width === 'narrow' ? 'narrow' : options?.width === 'abbreviated' || options?.width === 'short' ? 'abbreviated' : 'wide';
      return months[width][index];
    },
    day: (index, options) => days[(options?.width ?? 'wide') as Width][index],
  },
};
