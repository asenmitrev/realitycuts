import { cardAnatomy } from '@chakra-ui/anatomy';
import { createMultiStyleConfigHelpers } from '@chakra-ui/react';

const { definePartsStyle, defineMultiStyleConfig } = createMultiStyleConfigHelpers(cardAnatomy.keys);

const baseStyle = definePartsStyle({
  container: {
    backgroundColor: 'whiteAlpha.100',
    overflow: 'hidden',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'whiteAlpha.200',
    borderRadius: '24px',
    transition: 'border-color .425s',
    _hover: {
      borderColor: '#353535'
    }
  }
});

const variants = {
  attention: definePartsStyle({
    container: {
      borderColor: 'yellow.200',
      _hover: {
        borderColor: 'yellow.400'
      }
    }
  }),
  red: definePartsStyle({
    container: {
      borderColor: 'red.200',
      _hover: {
        borderColor: 'red.400'
      }
    }
  }),
  green: definePartsStyle({
    container: {
      borderColor: 'green.200',
      _hover: {
        borderColor: 'green.400'
      }
    }
  }),
  blue: definePartsStyle({
    container: {
      borderColor: 'blue.200',
      _hover: {
        borderColor: 'blue.400'
      }
    }
  })
};

export const cardTheme = defineMultiStyleConfig({ baseStyle, variants });
