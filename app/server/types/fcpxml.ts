export interface IFCPXML {
  xmeml: [
    {
      _attr: { version: '5' };
    },
    {
      sequence: [
        { name: string },
        { duration: number },
        {
          rate: [{ timebase: number }, { ntsc: 'FALSE' | 'TRUE' }];
        },
        { in: -1 },
        { out: -1 },
        {
          timecode: [
            { string: '00:00:00:00' },
            { frame: number },
            { displayformat: 'NDF' },
            {
              rate: [{ timebase: number }, { ntsc: 'FALSE' | 'TRUE' }];
            }
          ];
        },
        {
          media: [
            {
              video: [
                {
                  track: Array<
                    | {
                        clipitem: [
                          { _attr: { id: string } },
                          { name: string },
                          { duration: number },
                          { start: number },
                          { end: number },
                          { enabled: 'TRUE' | 'FALSE' },
                          { in: number },
                          { out: number },
                          {
                            file: [
                              { _attr: { id: string } },
                              { duration: number },
                              {
                                rate: [{ timebase: number }, { ntsc: 'FALSE' | 'TRUE' }];
                              },
                              {
                                media: [
                                  {
                                    video: [
                                      { duration: number },
                                      { samplecharacteristics: [{ width: number }, { height: number }] }
                                    ];
                                  }
                                ];
                              },
                              { name: string },
                              { pathurl: string }
                            ];
                          }
                        ];
                      }
                    // Add more clipitems here
                    | { enabled: 'TRUE' }
                    | { locked: 'FALSE' }
                  >;
                },
                {
                  track: Array<
                    | {
                        clipitem: [
                          { _attr: { id: string } },
                          { name: string },
                          { duration: number },
                          { start: number },
                          { end: number },
                          { enabled: 'TRUE' | 'FALSE' },
                          { in: number },
                          { out: number },
                          {
                            file: [
                              { _attr: { id: string } },
                              { duration: number },
                              {
                                rate: [{ timebase: number }, { ntsc: 'FALSE' | 'TRUE' }];
                              },
                              {
                                media: [
                                  {
                                    video: [
                                      { duration: number },
                                      { samplecharacteristics: [{ width: number }, { height: number }] }
                                    ];
                                  }
                                ];
                              },
                              { name: string },
                              { pathurl: string }
                            ];
                          }
                        ];
                      }
                    // Add more clipitems here
                    | { enabled: 'TRUE' }
                    | { locked: 'FALSE' }
                  >;
                },
                {
                  format: [
                    {
                      samplecharacteristics: [
                        { width: '1920' },
                        { height: '1080' },
                        { pixelaspectratio: 'square' },
                        {
                          rate: [{ timebase: '24' }, { ntsc: 'FALSE' }];
                        },
                        {
                          codec: [
                            {
                              appspecificdata: [
                                { appname: 'Final Cut Pro' },
                                { appmanufacturer: 'Apple Inc.' },
                                {
                                  data: [{ qtcodec: '' }];
                                }
                              ];
                            }
                          ];
                        }
                      ];
                    }
                  ];
                }
              ];
            },
            {
              audio: {
                track: Array<
                  | {
                      clipitem: (
                        | { _attr: { id: string } }
                        | { name: string }
                        | { duration: number }
                        | { start: number }
                        | { end: number }
                        | { enabled: 'TRUE' | 'FALSE' }
                        | { in: number }
                        | { out: number }
                        | {
                            sourcetrack: [
                              {
                                mediatype: 'audio';
                              },
                              {
                                trackindex: number;
                              }
                            ];
                          }
                        | {
                            filter: [
                              { enabled: 'TRUE' },
                              { start: number },
                              { end: number },
                              {
                                effect: [
                                  { name: 'Audio Levels' },
                                  { effectid: 'audiolevels' },
                                  { effecttype: 'audiolevels' },
                                  { mediatype: 'audio' },
                                  { effectcategory: 'audiolevels' },
                                  {
                                    parameter: [
                                      { name: 'Level' },
                                      { parameterid: 'level' },
                                      { value: number },
                                      { valuemin: '0' },
                                      { valuemax: '3.98109' }
                                    ];
                                  }
                                ];
                              }
                            ];
                          }
                        | {
                            file: (
                              | { _attr: { id: string } }
                              | { duration: number }
                              | { name: string }
                              | {
                                  rate: [{ timebase: number }, { ntsc: 'FALSE' | 'TRUE' }];
                                }
                              | {
                                  media: [{ audio: [{ channelcount: number }] }];
                                }
                              | { pathurl: string }
                            )[];
                          }
                      )[];
                    }
                  | { enabled: 'TRUE' }
                  | { locked: 'FALSE' }
                >;
              }[];
            }
          ];
        }
      ];
    }
  ];
}
