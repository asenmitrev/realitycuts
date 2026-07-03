import { SyncPrerecordedResponse } from '@deepgram/sdk';

export const mockTranscriptionResults: SyncPrerecordedResponse = {
  metadata: {
    transaction_key: 'deprecated',
    request_id: '2e6aba34-3760-420c-887d-4cc367342d36',
    sha256: '8eb810d9d31771e305ec249ec140152899124e18efaf275bc6b261513e8490c7',
    created: '2025-04-05T10:35:13.914Z',
    duration: 51.356,
    channels: 1,
    models: ['1abfe86b-e047-4eed-858a-35e5625b41ee'],
    model_info: {
      '1abfe86b-e047-4eed-858a-35e5625b41ee': {
        name: '2-general-nova',
        version: '2024-01-06.5664',
        arch: 'nova-2'
      }
    }
  },
  results: {
    channels: [
      {
        alternatives: [
          {
            transcript:
              "Nineteen forty one. When the Nazis invaded, Stalin gambled on a secret weapon, teenage girls in crop duster planes. The night witches flew rickety biplanes so flimsy, a bullet could tear them in half. Their tactic? Shut off engines, glide silently over German camps, and strike like shadows. Armed with stopwatches and homemade bombs, they tormented the Wehrmacht. Twenty three thousand missions flown, some pilots completing eight sorties a night. Their reward: the Germans called them witches. Their own commanders called them unfit for parades. But history calls them legends, the women who turned sewing needles into weapons and proved courage doesn't need armor.",
            confidence: 0.9992608,
            words: [
              {
                word: 'nineteen',
                start: 0.16,
                end: 0.56,
                confidence: 0.99803424,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'Nineteen'
              },
              {
                word: 'forty',
                start: 0.56,
                end: 0.96,
                confidence: 0.99988186,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'forty'
              },
              {
                word: 'one',
                start: 0.96,
                end: 1.46,
                confidence: 0.9759003,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'one.'
              },
              {
                word: 'when',
                start: 1.92,
                end: 2.1599998,
                confidence: 0.9997261,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'When'
              },
              {
                word: 'the',
                start: 2.1599998,
                end: 2.32,
                confidence: 0.9997882,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'the'
              },
              {
                word: 'nazis',
                start: 2.32,
                end: 2.82,
                confidence: 0.999741,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'Nazis'
              },
              {
                word: 'invaded',
                start: 2.8799999,
                end: 3.3799999,
                confidence: 0.9998958,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'invaded,'
              },
              {
                word: 'stalin',
                start: 3.9199998,
                end: 4.4,
                confidence: 0.99992394,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'Stalin'
              },
              {
                word: 'gambled',
                start: 4.4,
                end: 4.7999997,
                confidence: 0.9994634,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'gambled'
              },
              {
                word: 'on',
                start: 4.7999997,
                end: 4.96,
                confidence: 0.99994206,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'on'
              },
              {
                word: 'a',
                start: 4.96,
                end: 5.12,
                confidence: 0.99984133,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'a'
              },
              {
                word: 'secret',
                start: 5.12,
                end: 5.52,
                confidence: 0.99997854,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'secret'
              },
              {
                word: 'weapon',
                start: 5.52,
                end: 6.02,
                confidence: 0.89610624,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'weapon,'
              },
              {
                word: 'teenage',
                start: 6.3999996,
                end: 6.8799996,
                confidence: 0.99624133,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'teenage'
              },
              {
                word: 'girls',
                start: 6.8799996,
                end: 7.2799997,
                confidence: 0.99982315,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'girls'
              },
              {
                word: 'in',
                start: 7.2799997,
                end: 7.52,
                confidence: 0.9988985,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'in'
              },
              {
                word: 'crop',
                start: 7.52,
                end: 7.8399997,
                confidence: 0.9950978,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'crop'
              },
              {
                word: 'duster',
                start: 7.8399997,
                end: 8.32,
                confidence: 0.9928781,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'duster'
              },
              {
                word: 'planes',
                start: 8.32,
                end: 8.82,
                confidence: 0.99837685,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'planes.'
              },
              {
                word: 'the',
                start: 9.44,
                end: 9.679999,
                confidence: 0.999851,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'The'
              },
              {
                word: 'night',
                start: 9.679999,
                end: 9.92,
                confidence: 0.97635275,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'night'
              },
              {
                word: 'witches',
                start: 9.92,
                end: 10.32,
                confidence: 0.998063,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'witches'
              },
              {
                word: 'flew',
                start: 10.32,
                end: 10.639999,
                confidence: 0.9995049,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'flew'
              },
              {
                word: 'rickety',
                start: 10.639999,
                end: 11.04,
                confidence: 0.99991006,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'rickety'
              },
              {
                word: 'biplanes',
                start: 11.04,
                end: 11.54,
                confidence: 0.9460813,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'biplanes'
              },
              {
                word: 'so',
                start: 11.759999,
                end: 11.92,
                confidence: 0.98884016,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'so'
              },
              {
                word: 'flimsy',
                start: 11.92,
                end: 12.42,
                confidence: 0.9140279,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'flimsy,'
              },
              {
                word: 'a',
                start: 12.719999,
                end: 12.88,
                confidence: 0.9997528,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'a'
              },
              {
                word: 'bullet',
                start: 12.88,
                end: 13.36,
                confidence: 0.99999225,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'bullet'
              },
              {
                word: 'could',
                start: 13.36,
                end: 13.5199995,
                confidence: 0.9997824,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'could'
              },
              {
                word: 'tear',
                start: 13.5199995,
                end: 13.759999,
                confidence: 0.99991,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'tear'
              },
              {
                word: 'them',
                start: 13.759999,
                end: 14,
                confidence: 0.99991465,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'them'
              },
              {
                word: 'in',
                start: 14,
                end: 14.16,
                confidence: 0.9982748,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'in'
              },
              {
                word: 'half',
                start: 14.16,
                end: 14.66,
                confidence: 0.99984753,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'half.'
              },
              {
                word: 'their',
                start: 15.035,
                end: 15.535,
                confidence: 0.9995284,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'Their'
              },
              {
                word: 'tactic',
                start: 15.995,
                end: 16.494999,
                confidence: 0.9626249,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'tactic?'
              },
              {
                word: 'shut',
                start: 16.795,
                end: 16.955,
                confidence: 0.99769324,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'Shut'
              },
              {
                word: 'off',
                start: 16.955,
                end: 17.195,
                confidence: 0.94167894,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'off'
              },
              {
                word: 'engines',
                start: 17.195,
                end: 17.695,
                confidence: 0.97141707,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'engines,'
              },
              {
                word: 'glide',
                start: 18.235,
                end: 18.715,
                confidence: 0.95171756,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'glide'
              },
              {
                word: 'silently',
                start: 18.715,
                end: 19.215,
                confidence: 0.9999281,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'silently'
              },
              {
                word: 'over',
                start: 19.275,
                end: 19.595001,
                confidence: 0.9998853,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'over'
              },
              {
                word: 'german',
                start: 19.595001,
                end: 19.994999,
                confidence: 0.9998246,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'German'
              },
              {
                word: 'camps',
                start: 19.994999,
                end: 20.494999,
                confidence: 0.9383179,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'camps,'
              },
              {
                word: 'and',
                start: 20.635,
                end: 20.955,
                confidence: 0.999772,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'and'
              },
              {
                word: 'strike',
                start: 20.955,
                end: 21.275,
                confidence: 0.99989307,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'strike'
              },
              {
                word: 'like',
                start: 21.275,
                end: 21.675,
                confidence: 0.9997502,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'like'
              },
              {
                word: 'shadows',
                start: 21.675,
                end: 22.175,
                confidence: 0.99969715,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'shadows.'
              },
              {
                word: 'armed',
                start: 23.435001,
                end: 23.835,
                confidence: 0.99976474,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'Armed'
              },
              {
                word: 'with',
                start: 23.835,
                end: 23.994999,
                confidence: 0.9999304,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'with'
              },
              {
                word: 'stopwatches',
                start: 23.994999,
                end: 24.494999,
                confidence: 0.9617936,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'stopwatches'
              },
              {
                word: 'and',
                start: 24.715,
                end: 24.955,
                confidence: 0.99970007,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'and'
              },
              {
                word: 'homemade',
                start: 24.955,
                end: 25.455,
                confidence: 0.9981267,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'homemade'
              },
              {
                word: 'bombs',
                start: 25.515,
                end: 26.015,
                confidence: 0.9992608,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'bombs,'
              },
              {
                word: 'they',
                start: 26.314999,
                end: 26.635,
                confidence: 0.99968636,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'they'
              },
              {
                word: 'tormented',
                start: 26.635,
                end: 27.135,
                confidence: 0.99933505,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'tormented'
              },
              {
                word: 'the',
                start: 27.195,
                end: 27.355,
                confidence: 0.9999207,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'the'
              },
              {
                word: 'wehrmacht',
                start: 27.355,
                end: 27.855,
                confidence: 0.9170186,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'Wehrmacht.'
              },
              {
                word: 'twenty',
                start: 28.59,
                end: 28.91,
                confidence: 0.9957903,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'Twenty'
              },
              {
                word: 'three',
                start: 28.91,
                end: 29.31,
                confidence: 0.99831593,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'three'
              },
              {
                word: 'thousand',
                start: 29.31,
                end: 29.81,
                confidence: 0.9988859,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'thousand'
              },
              {
                word: 'missions',
                start: 29.87,
                end: 30.27,
                confidence: 0.9987962,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'missions'
              },
              {
                word: 'flown',
                start: 30.27,
                end: 30.77,
                confidence: 0.8970573,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'flown,'
              },
              {
                word: 'some',
                start: 31.23,
                end: 31.470001,
                confidence: 0.99918824,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'some'
              },
              {
                word: 'pilots',
                start: 31.470001,
                end: 31.970001,
                confidence: 0.99965787,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'pilots'
              },
              {
                word: 'completing',
                start: 32.03,
                end: 32.53,
                confidence: 0.99922526,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'completing'
              },
              {
                word: 'eight',
                start: 32.59,
                end: 32.91,
                confidence: 0.999689,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'eight'
              },
              {
                word: 'sorties',
                start: 32.91,
                end: 33.39,
                confidence: 0.9996582,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'sorties'
              },
              {
                word: 'a',
                start: 33.39,
                end: 33.47,
                confidence: 0.9990688,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'a'
              },
              {
                word: 'night',
                start: 33.47,
                end: 33.97,
                confidence: 0.9980156,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'night.'
              },
              {
                word: 'their',
                start: 34.510002,
                end: 34.75,
                confidence: 0.99827135,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'Their'
              },
              {
                word: 'reward',
                start: 34.75,
                end: 35.25,
                confidence: 0.7372984,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'reward:'
              },
              {
                word: 'the',
                start: 36.11,
                end: 36.35,
                confidence: 0.7453542,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'the'
              },
              {
                word: 'germans',
                start: 36.35,
                end: 36.85,
                confidence: 0.9997187,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'Germans'
              },
              {
                word: 'called',
                start: 36.91,
                end: 37.15,
                confidence: 0.99884915,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'called'
              },
              {
                word: 'them',
                start: 37.15,
                end: 37.55,
                confidence: 0.99962056,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'them'
              },
              {
                word: 'witches',
                start: 37.55,
                end: 38.05,
                confidence: 0.67576146,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'witches.'
              },
              {
                word: 'their',
                start: 38.59,
                end: 38.75,
                confidence: 0.9988796,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'Their'
              },
              {
                word: 'own',
                start: 38.75,
                end: 39.07,
                confidence: 0.9993741,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'own'
              },
              {
                word: 'commanders',
                start: 39.07,
                end: 39.57,
                confidence: 0.9998197,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'commanders'
              },
              {
                word: 'called',
                start: 39.63,
                end: 39.87,
                confidence: 0.99360496,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'called'
              },
              {
                word: 'them',
                start: 39.87,
                end: 40.37,
                confidence: 0.9996978,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'them'
              },
              {
                word: 'unfit',
                start: 40.510002,
                end: 41.010002,
                confidence: 0.98109597,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'unfit'
              },
              {
                word: 'for',
                start: 41.07,
                end: 41.23,
                confidence: 0.9998628,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'for'
              },
              {
                word: 'parades',
                start: 41.23,
                end: 41.73,
                confidence: 0.9602208,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'parades.'
              },
              {
                word: 'but',
                start: 42.591,
                end: 42.831,
                confidence: 0.99866235,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'But'
              },
              {
                word: 'history',
                start: 42.831,
                end: 43.311,
                confidence: 0.9997029,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'history'
              },
              {
                word: 'calls',
                start: 43.311,
                end: 43.551,
                confidence: 0.9972868,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'calls'
              },
              {
                word: 'them',
                start: 43.551,
                end: 43.951,
                confidence: 0.9998319,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'them'
              },
              {
                word: 'legends',
                start: 43.951,
                end: 44.451,
                confidence: 0.67317986,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'legends,'
              },
              {
                word: 'the',
                start: 45.231,
                end: 45.471,
                confidence: 0.9984498,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'the'
              },
              {
                word: 'women',
                start: 45.471,
                end: 45.791,
                confidence: 0.998206,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'women'
              },
              {
                word: 'who',
                start: 45.791,
                end: 46.111,
                confidence: 0.99924195,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'who'
              },
              {
                word: 'turned',
                start: 46.111,
                end: 46.511,
                confidence: 0.99618834,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'turned'
              },
              {
                word: 'sewing',
                start: 46.511,
                end: 46.911,
                confidence: 0.9993622,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'sewing'
              },
              {
                word: 'needles',
                start: 46.911,
                end: 47.231,
                confidence: 0.99950147,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'needles'
              },
              {
                word: 'into',
                start: 47.231,
                end: 47.551,
                confidence: 0.99957496,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'into'
              },
              {
                word: 'weapons',
                start: 47.551,
                end: 48.051,
                confidence: 0.99966764,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'weapons'
              },
              {
                word: 'and',
                start: 48.591,
                end: 48.831,
                confidence: 0.58497244,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'and'
              },
              {
                word: 'proved',
                start: 48.831,
                end: 49.231,
                confidence: 0.99931943,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'proved'
              },
              {
                word: 'courage',
                start: 49.231,
                end: 49.731,
                confidence: 0.99892503,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'courage'
              },
              {
                word: "doesn't",
                start: 49.791,
                end: 50.111,
                confidence: 0.9985801,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: "doesn't"
              },
              {
                word: 'need',
                start: 50.111,
                end: 50.431,
                confidence: 0.999736,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'need'
              },
              {
                word: 'armor',
                start: 50.431,
                end: 50.931,
                confidence: 0.99843323,
                speaker: 0,
                speaker_confidence: 1,
                punctuated_word: 'armor.'
              }
            ],
            paragraphs: {
              transcript:
                "\nSpeaker 0: Nineteen forty one. When the Nazis invaded, Stalin gambled on a secret weapon, teenage girls in crop duster planes. The night witches flew rickety biplanes so flimsy, a bullet could tear them in half. Their tactic? Shut off engines, glide silently over German camps, and strike like shadows.\n\nArmed with stopwatches and homemade bombs, they tormented the Wehrmacht. Twenty three thousand missions flown, some pilots completing eight sorties a night. Their reward: the Germans called them witches. Their own commanders called them unfit for parades. But history calls them legends, the women who turned sewing needles into weapons and proved courage doesn't need armor.",
              paragraphs: [
                {
                  sentences: [
                    {
                      text: 'Nineteen forty one.',
                      start: 0.16,
                      end: 1.46
                    },
                    {
                      text: 'When the Nazis invaded, Stalin gambled on a secret weapon, teenage girls in crop duster planes.',
                      start: 1.92,
                      end: 8.82
                    },
                    {
                      text: 'The night witches flew rickety biplanes so flimsy, a bullet could tear them in half.',
                      start: 9.44,
                      end: 14.66
                    },
                    {
                      text: 'Their tactic?',
                      start: 15.035,
                      end: 16.494999
                    },
                    {
                      text: 'Shut off engines, glide silently over German camps, and strike like shadows.',
                      start: 16.795,
                      end: 22.175
                    }
                  ],
                  speaker: 0,
                  num_words: 48,
                  start: 0.16,
                  end: 22.175
                },
                {
                  sentences: [
                    {
                      text: 'Armed with stopwatches and homemade bombs, they tormented the Wehrmacht.',
                      start: 23.435001,
                      end: 27.855
                    },
                    {
                      text: 'Twenty three thousand missions flown, some pilots completing eight sorties a night.',
                      start: 28.59,
                      end: 33.97
                    },
                    {
                      text: 'Their reward: the Germans called them witches.',
                      start: 34.510002,
                      end: 38.05
                    },
                    {
                      text: 'Their own commanders called them unfit for parades.',
                      start: 38.59,
                      end: 41.73
                    },
                    {
                      text: "But history calls them legends, the women who turned sewing needles into weapons and proved courage doesn't need armor.",
                      start: 42.591,
                      end: 50.931
                    }
                  ],
                  speaker: 0,
                  num_words: 56,
                  start: 23.435001,
                  end: 50.931
                }
              ]
            }
          }
        ]
      }
    ]
  }
};
