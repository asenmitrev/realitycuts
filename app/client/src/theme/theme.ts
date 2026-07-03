import { extendTheme, StyleFunctionProps } from '@chakra-ui/react';
import { cardTheme } from './cardTheme.ts';

import { theme } from '@chakra-ui/react';

export const mainTheme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false
  },

  colors: {
    white: {
      200: 'white'
    },
    gray: {
      ...theme.colors.gray,
      200: '#585858'
    },
    green: {
      ...theme.colors.green,
      200: '#39ff76',
      300: '#2FDF8C',
      600: '#1d803b',
      800: '#0b3318'
    },
    blue: {
      ...theme.colors.blue,
      100: '#8bdeff',
      200: '#0097ff',
      800: '#08406c'
    },
    red: {
      ...theme.colors.red,
      200: '#ff2740'
    },
    yellow: {
      ...theme.colors.yellow,
      400: '#ffd013'
    },
    teal: {
      ...theme.colors.teal,
      200: '#22D0FF'
    }
  },
  components: {
    Card: cardTheme,
    Input: {
      ...theme.components.Input,
      variants: {
        outline: {
          field: {
            borderRadius: '8px',
            border: '1px solid',
            borderColor: '#555',
            backgroundColor: 'whiteAlpha.50',
            _hover: {
              borderColor: '#777'
            },
            _focus: {
              borderColor: '#448eff'
            }
          }
        }
      }
    },
    FormLabel: {
      baseStyle: {
        color: 'white'
      }
    },
    Textarea: {
      variants: {
        outline: {
          borderRadius: '8px',
          border: '1px solid',
          borderColor: '#555',
          backgroundColor: 'whiteAlpha.50',
          _hover: {
            borderColor: '#777'
          },
          _focus: {
            borderColor: '#448eff'
          }
        }
      }
    },
    Button: {
      ...theme.components.Button,
      baseStyle: {
        ...theme.components.Button.baseStyle,
        borderRadius: '5px'
      },
      variants: {
        ...theme.components.Button.variants,
        outline: (props: StyleFunctionProps) => ({
          ...theme.components.Button.variants?.outline(props),
          backgroundColor: 'whiteAlpha.100',
          transitionDuration: '0.45s',
          _hover: {
            backgroundColor: '#333'
          }
        }),

        solid: (props: StyleFunctionProps) => ({
          ...theme.components.Button.variants?.solid(props),
          transitionDuration: '0.45s',
          _hover: {
            backgroundColor: '#c4c4c4'
          }
        })
      }
    },
    Modal: {
      baseStyle: {
        dialog: {
          backgroundColor: 'rgb(17, 24, 39)',
          border: '1px solid #585858'
        },
        overlay: {
          backdropFilter: 'blur(5px)'
        }
      }
    },
    Popover: {
      baseStyle: {
        popper: {
          zIndex: 10
        }
      }
    },
    Heading: {
      ...theme.components.Heading,
      baseStyle: {
        ...theme.components.Heading.baseStyle,
        color: 'white',
        fontFamily: 'Outfit, sans-serif'
      }
    }
  },
  styles: {
    global: {
      html: {
        fontSize: '15px'
      },
      // styles for the `body`
      body: {
        fontFamily: 'IBM Plex Sans Hebrew, sans-serif',
        bg: 'linear-gradient(rgb(17, 24, 39), rgb(17, 24, 39), rgb(31, 41, 55))',
        color: '#7d7d7d'
      }
    }
  }
});
