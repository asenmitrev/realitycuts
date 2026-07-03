import { FC } from 'react';
import { Box, AspectRatio, Text, VStack, HStack, useColorModeValue, Icon, Badge, Flex, Image } from '@chakra-ui/react';
import { useFormContext } from 'react-hook-form';
import { AutomationConfigFormData } from '../../types';
import { FaImage, FaMusic, FaVideo } from 'react-icons/fa6';

interface VideoOutputPreviewProps {
  brandAssets: { _id: string; name?: string; s3UploadId: { url: string } }[];
}

export const VideoOutputPreview: FC<VideoOutputPreviewProps> = ({ brandAssets }) => {
  const { watch } = useFormContext<AutomationConfigFormData>();

  const orientation = watch('contentSettings.orientation') || 'vertical';
  const captionSettings = watch('contentSettings.captionPreset');
  const brandWatermarkPosition = watch('contentSettings.brandWatermarkPosition');
  const brandWatermarkUploadId = watch('contentSettings.brandWatermarkUploadId');
  const includeMusic = watch('contentSettings.includeMusic');

  const bgColor = useColorModeValue('gray.900', 'gray.900');
  const borderColor = useColorModeValue('whiteAlpha.300', 'whiteAlpha.300');
  const textColor = useColorModeValue('white', 'white');

  const isVertical = orientation === 'vertical';

  // Calculate caption position
  const getCaptionPosition = () => {
    if (!captionSettings) return 'bottom';
    const marginV = captionSettings.marginV || 15;
    if (marginV > 60) return 'top';
    if (marginV > 30) return 'center';
    return 'bottom';
  };

  const captionPosition = getCaptionPosition();

  // Get watermark URL
  // Note: brandAssets might be empty initially while loading, so we check if array has items
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

  return (
    <VStack spacing={4} align="stretch">
      <Box>
        <Text color={textColor} fontSize="sm" fontWeight="semibold" mb={2}>
          Video Output Preview
        </Text>
        <Text color="gray.400" fontSize="xs" mb={4}>
          This is how your final video layout will be arranged
        </Text>
      </Box>

      <Flex justify="center" w="100%">
        <AspectRatio ratio={isVertical ? 9 / 16 : 16 / 9} width="100%" maxW={isVertical ? '240px' : '360px'}>
          <Box
            bg={bgColor}
            borderRadius="lg"
            border="2px solid"
            borderColor={borderColor}
            overflow="hidden"
            position="relative"
          >
            {/* Video Content Area */}
            <Box
              position="absolute"
              top="0"
              left="0"
              right="0"
              bottom="0"
              bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <VStack spacing={2} color="whiteAlpha.600">
                <Icon as={FaVideo} boxSize={8} />
                <Text fontSize="xs" fontWeight="semibold">
                  Video Content
                </Text>
              </VStack>
            </Box>

            {/* Caption Area Indicator */}
            {captionSettings && (
              <Box
                position="absolute"
                left="10%"
                right="10%"
                height="20%"
                bg="rgba(255, 255, 255, 0.1)"
                borderRadius="md"
                border="1px dashed"
                borderColor="whiteAlpha.500"
                display="flex"
                alignItems="center"
                justifyContent="center"
                {...(captionPosition === 'top'
                  ? { top: '10%' }
                  : captionPosition === 'center'
                  ? { top: '40%' }
                  : { bottom: '10%' })}
              >
                <Text fontSize="9px" color="whiteAlpha.700" fontWeight="bold">
                  CAPTIONS
                </Text>
              </Box>
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
              <Box w="8px" h="8px" bg="whiteAlpha.300" borderRadius="sm" />
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
              <Text>Background music included</Text>
            </HStack>
          )}
        </HStack>
      </VStack>
    </VStack>
  );
};
