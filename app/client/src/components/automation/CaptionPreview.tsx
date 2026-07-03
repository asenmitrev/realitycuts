import { FC } from 'react';
import { Box, AspectRatio, Text, VStack, useColorModeValue } from '@chakra-ui/react';
import { useFormContext } from 'react-hook-form';
import { AutomationConfigFormData, CaptionSettings } from '../../types';

const SAMPLE_TEXT = 'THIS IS HOW YOUR CAPTIONS WILL LOOK';

interface CaptionPreviewProps {
  orientation?: 'vertical' | 'horizontal';
}

export const CaptionPreview: FC<CaptionPreviewProps> = () => {
  const { watch } = useFormContext<AutomationConfigFormData>();

  const captionSettings = watch('contentSettings.captionPreset');
  const contentOrientation = watch('contentSettings.orientation') || 'vertical';

  const bgColor = useColorModeValue('gray.900', 'gray.900');
  const isVertical = contentOrientation === 'vertical';

  if (!captionSettings) {
    return (
      <Box p={4} bg={bgColor} borderRadius="md">
        <Text color="gray.400" textAlign="center">
          Select a caption preset to see preview
        </Text>
      </Box>
    );
  }

  const getCaptionStyle = (settings: CaptionSettings, isActive: boolean = false) => {
    const fontSize = isVertical
      ? isActive && settings.verticalActiveWordFontSize
        ? settings.verticalActiveWordFontSize
        : settings.verticalFontSize || 120
      : isActive && settings.activeWordFontSize
      ? settings.activeWordFontSize
      : settings.fontSize || 90;

    const scaleFactor = 0.15; // Scale down for preview
    const scaledFontSize = fontSize * scaleFactor;

    let color = settings.primaryColor || '#ffffff';
    let backgroundColor = 'transparent';

    if (settings.type === 'WORD_HIGHLIGHT' && isActive) {
      color = settings.highlightedWordColor || color;
    } else if (settings.type === 'WORD_BACKGROUND' && isActive) {
      color = settings.highlightedWordColor || color;
      backgroundColor = settings.backgroundColor || '#9013fe';
    }

    const textShadow = settings.shadow
      ? `0 ${settings.shadow * scaleFactor}px ${settings.shadow * 2 * scaleFactor}px rgba(0,0,0,0.5)`
      : 'none';
    const textStroke = settings.outlineWidth
      ? `${settings.outlineWidth * scaleFactor}px ${settings.outlineColor || '#000000'}`
      : 'none';

    return {
      fontFamily: `'${settings.fontFamily || 'Montserrat-Bold'}', sans-serif`,
      fontSize: `${scaledFontSize}px`,
      color: color,
      backgroundColor: backgroundColor,
      textTransform: settings.isUppercase ? 'uppercase' : 'none',
      textShadow: textShadow,
      WebkitTextStroke: textStroke,
      padding: backgroundColor !== 'transparent' ? '2px 6px' : '0',
      borderRadius: '0',
      display: 'inline-block',
      margin: '0 2px'
    } as React.CSSProperties;
  };

  const getPosition = () => {
    // Get position from marginV field
    const marginV = captionSettings.marginV;

    // Use marginV to determine position
    if (marginV !== undefined && marginV !== null) {
      if (marginV > 60) return 'flex-start'; // top
      if (marginV > 30) return 'center'; // center
      return 'flex-end'; // bottom
    }

    // Default to bottom if marginV is not set
    return 'flex-end';
  };

  const words = SAMPLE_TEXT.split(' ');
  const activeWordIndex = Math.floor(words.length / 2);

  return (
    <AspectRatio ratio={isVertical ? 9 / 16 : 16 / 9} width="100%" maxW={isVertical ? '200px' : '300px'}>
      <Box
        bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        borderRadius="md"
        overflow="hidden"
        position="relative"
        display="flex"
        justifyContent="center"
        p={4}
      >
        <VStack spacing={1} alignSelf={getPosition()}>
          <Box textAlign="center" lineHeight="1.2">
            {words.map((word, index) => {
              const isActive =
                captionSettings.type !== 'WORD_APPEAR' ? index === activeWordIndex : index <= activeWordIndex;

              if (captionSettings.type === 'WORD_APPEAR' && !isActive) {
                return null;
              }

              return (
                <span key={index} style={getCaptionStyle(captionSettings, isActive)}>
                  {word}
                </span>
              );
            })}
          </Box>
        </VStack>
      </Box>
    </AspectRatio>
  );
};
