import React, { FC } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Text, Icon, useColorModeValue } from '@chakra-ui/react';

import { FaUpload } from 'react-icons/fa';

export const MyDropzone: FC<{
  height?: number;
  onDrop: (files: File[]) => void;
  type?: 'audio' | 'video' | 'mixed-video-image';
  fileSelected?: File;
}> = React.memo(({ onDrop, type = 'video', fileSelected }) => {
  const borderColor = useColorModeValue('whiteAlpha.200', 'whiteAlpha.200');
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // maxSize: 1073741824,
    accept:
      type === 'video'
        ? {
            'video/mp4': ['.mp4'],
            'video/mov': ['.mov'],
            'video/quicktime': ['.mov'],
            'video/x-m4v': ['.m4v'],
            'video/mpeg': ['.mpeg'],
            'video/mpg': ['.mpg'],
            'video/webm': ['.webm'],
            'video/avi': ['.avi'],
            'video/mkv': ['.mkv']
          }
        : type === 'audio'
        ? {
            'audio/mpeg': ['.mp3'],
            'audio/wav': ['.wav'],
            'audio/ogg': ['.ogg'],
            'audio/flac': ['.flac'],
            'audio/m4a': ['.m4a'],
            'audio/aac': ['.aac']
          }
        : {
            'video/mp4': ['.mp4'],
            'video/mov': ['.mov'],
            'video/quicktime': ['.mov'],
            'video/x-m4v': ['.m4v'],
            'video/mpeg': ['.mpeg'],
            'video/mpg': ['.mpg'],
            'video/webm': ['.webm'],
            'video/avi': ['.avi'],
            'video/mkv': ['.mkv'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'audio/x-heic': ['.heic'],
            'image/gif': ['.gif'],
            'image/webp': ['.webp'],
            'image/svg+xml': ['.svg']
          }
  });

  return (
    <Box
      {...getRootProps()}
      width="full"
      borderWidth={2}
      borderStyle="dashed"
      borderColor={isDragActive ? 'blue.500' : borderColor}
      borderRadius="lg"
      p={8}
      textAlign="center"
      transition="border-color 0.2s ease-in-out"
      cursor="pointer"
      className="dropzone"
      bg={useColorModeValue('whiteAlpha.100', 'whiteAlpha.100')}
      _hover={{
        borderColor: 'blue.500'
      }}
    >
      <input {...getInputProps()} />
      <Icon as={FaUpload} w={6} h={6} color="gray.400" mb={2} mt={4} />
      <Text color="gray.500" mt={4}>
        {fileSelected ? fileSelected.name : "Drag 'n' drop some files here, or click to select files"}
      </Text>
    </Box>
  );
});
