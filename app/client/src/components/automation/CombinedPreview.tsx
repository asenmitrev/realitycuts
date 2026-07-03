import { FC } from 'react';
import { Box, AspectRatio, Text, VStack, HStack, useColorModeValue, Icon, Badge, Flex, Image } from '@chakra-ui/react';
import { useFormContext } from 'react-hook-form';
import { AutomationConfigFormData, CaptionSettings } from '../../types';
import { FaImage, FaMusic, FaVideo } from 'react-icons/fa6';

const SAMPLE_TEXT = 'This is how your captions will look';

interface CombinedPreviewProps {
  brandAssets: { _id: string; name?: string; s3UploadId: { url: string } }[];
}

export const CombinedPreview: FC<CombinedPreviewProps> = ({ brandAssets }) => {
  const { watch } = useFormContext<AutomationConfigFormData>();

  const captionSettings = watch('contentSettings.captionPreset');
  const orientation = watch('contentSettings.orientation') || 'vertical';
  const brandWatermarkPosition = watch('contentSettings.brandWatermarkPosition');
  const brandWatermarkUploadId = watch('contentSettings.brandWatermarkUploadId');
  const includeMusic = watch('contentSettings.includeMusic');

  const bgColor = useColorModeValue('gray.800', 'gray.800');
  const borderColor = useColorModeValue('whiteAlpha.200', 'whiteAlpha.200');
  const textColor = useColorModeValue('white', 'white');

  const isVertical = orientation === 'vertical';

  // Get caption style from CaptionPreview logic
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
      fontFamily: `${settings.fontFamily || 'Montserrat-Bold'}, sans-serif`,
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

  const getCaptionPosition = () => {
    if (!captionSettings) return { position: 'bottom', justifySelf: 'flex-end' };
    const marginV = captionSettings.marginV;
    if (marginV !== undefined && marginV !== null) {
      if (marginV > 60) return { position: 'top', justifySelf: 'flex-start' };
      if (marginV > 30) return { position: 'center', justifySelf: 'center' };
      return { position: 'bottom', justifySelf: 'flex-end' };
    }
    return { position: 'bottom', justifySelf: 'flex-end' };
  };

  const { position: captionPosition, justifySelf: captionJustifySelf } = getCaptionPosition();

  // Get watermark URL
  const watermarkUrl =
    brandWatermarkUploadId && brandAssets.length > 0
      ? brandAssets.find(a => a._id === brandWatermarkUploadId)?.s3UploadId?.url
      : undefined;

  // Calculate watermark position
  const getWatermarkStyle = () => {
    if (!brandWatermarkUploadId || !brandWatermarkPosition) return {};

    const baseStyle = {
      position: 'absolute' as const,
      width: '24px',
      height: '24px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    };

    switch (brandWatermarkPosition) {
      case 'top-left':
        return { ...baseStyle, top: '8px', left: '8px' };
      case 'top-right':
        return { ...baseStyle, top: '8px', right: '8px' };
      case 'bottom-left':
        return { ...baseStyle, bottom: '8px', left: '8px' };
      case 'bottom-right':
        return { ...baseStyle, bottom: '8px', right: '8px' };
      case 'center':
        return { ...baseStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      default:
        return {};
    }
  };

  const words = SAMPLE_TEXT.split(' ');
  const activeWordIndex = Math.floor(words.length / 2);

  return (
    <Box
      position={{ base: 'relative', lg: 'sticky' }}
      top={{ base: 'auto', lg: '20px' }}
      bg={bgColor}
      p={6}
      borderRadius="xl"
      border="1px solid"
      borderColor={borderColor}
      h="fit-content"
    >
      <VStack spacing={4} align="stretch">
        <Box>
          <Text color={textColor} fontSize="sm" fontWeight="semibold" mb={2}>
            Video Preview
          </Text>
          <Text color="gray.400" fontSize="xs" mb={4}>
            Preview of your final video output with captions, watermark, and layout
          </Text>
        </Box>

        <Flex justify="center" w="100%">
          <AspectRatio ratio={isVertical ? 9 / 16 : 16 / 9} width="100%" maxW={isVertical ? '280px' : '400px'}>
            <Box
              bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              borderRadius="lg"
              border="2px solid"
              borderColor={borderColor}
              overflow="hidden"
              position="relative"
              display="flex"
              flexDirection="row"
              justifyContent="center"
              p={4}
            >
              {/* Video Content Indicator */}
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                opacity={0.3}
                pointerEvents="none"
                zIndex={0}
              >
                <VStack spacing={2} color="whiteAlpha.700">
                  <Icon as={FaVideo} boxSize={8} />
                  <Text fontSize="xs" fontWeight="semibold">
                    Video Content
                  </Text>
                </VStack>
              </Box>

              {/* Caption Rendering */}
              {captionSettings && (
                <VStack
                  spacing={1}
                  zIndex={1}
                  position="relative"
                  alignSelf={captionJustifySelf}
                  mb={captionJustifySelf === 'flex-end' && isVertical ? '30%' : undefined}
                >
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
              )}

              {/* Brand Watermark */}
              {brandWatermarkUploadId && brandWatermarkPosition && (
                <Box {...getWatermarkStyle()}>
                  {watermarkUrl ? (
                    <Image src={watermarkUrl} alt="Brand watermark" objectFit="contain" width="100%" height="100%" />
                  ) : (
                    <Icon as={FaImage} boxSize={2} color="whiteAlpha.800" />
                  )}
                </Box>
              )}

              {/* Music Indicator */}
              {includeMusic && (
                <Box
                  position="absolute"
                  bottom="4px"
                  left="4px"
                  bg="rgba(0, 0, 0, 0.5)"
                  borderRadius="sm"
                  px={2}
                  py={1}
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <Icon as={FaMusic} boxSize={2} color="white" />
                  <Text fontSize="8px" color="white" fontWeight="semibold">
                    MUSIC
                  </Text>
                </Box>
              )}

              {/* Orientation Badge */}
              <Badge
                position="absolute"
                top="4px"
                right="4px"
                colorScheme={isVertical ? 'purple' : 'blue'}
                fontSize="8px"
              >
                {isVertical ? '9:16' : '16:9'}
              </Badge>

              {/* Content Type Badge */}
              <Badge
                position="absolute"
                top="4px"
                left="4px"
                colorScheme="orange"
                fontSize="8px"
              >
                SCRIPT
              </Badge>
            </Box>
          </AspectRatio>
        </Flex>

        {/* Legend */}
        <VStack spacing={2} align="stretch" fontSize="xs" color="gray.400">
          <HStack spacing={4} flexWrap="wrap">
            {captionSettings && (
              <HStack spacing={1}>
                <Box w="8px" h="8px" bg="purple.400" borderRadius="sm" />
                <Text>Captions: {captionPosition}</Text>
              </HStack>
            )}
            {brandWatermarkUploadId && (
              <HStack spacing={1}>
                <Icon as={FaImage} boxSize={3} />
                <Text>Watermark: {brandWatermarkPosition?.replace('-', ' ')}</Text>
              </HStack>
            )}
            {includeMusic && (
              <HStack spacing={1}>
                <Icon as={FaMusic} boxSize={3} />
                <Text>Background music</Text>
              </HStack>
            )}
          </HStack>
        </VStack>
      </VStack>
    </Box>
  );
};
