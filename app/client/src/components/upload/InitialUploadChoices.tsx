import React, { FC } from 'react';
import { Card, CardBody, CardHeader, Flex, Text, Heading } from '@chakra-ui/react';
import { useRole } from '../../contexts/profile/hooks';
import { UploadType } from '../../types';

export const InitialUploadChoices: FC<{ chooseType: (type: UploadType) => void }> = React.memo(({ chooseType }) => {
  const role = useRole();
  return (
    <>
      <Flex gap={10} textAlign="center" flexWrap="wrap">
        {role === 'user' ? null : (
          <Card onClick={() => chooseType('highlight')} cursor="pointer" w={{ base: '100%', md: '45%' }}>
            <CardHeader>
              <Heading size="md">Highlight</Heading>
            </CardHeader>

            <CardBody>
              <Text>Choose this option if you want to submit a long video for highlighting.</Text>
            </CardBody>
          </Card>
        )}
        <Card
          onClick={() => {
            chooseType('video');
          }}
          cursor="pointer"
          w={{ base: '100%', md: '45%' }}
        >
          <CardHeader>
            <Heading size="md">Talking Head Video</Heading>
          </CardHeader>

          <CardBody>
            <Text>Upload a pre-recorded video of yourself speaking.</Text>
          </CardBody>
        </Card>
        <Card
          onClick={() => {
            chooseType('script');
          }}
          cursor="pointer"
          w={{ base: '100%', md: '45%' }}
        >
          <CardHeader>
            <Heading size="md">Faceless Video</Heading>
          </CardHeader>

          <CardBody>
            <Text>Paste your script and our AI will generate the voiceover or upload a pre-recorded audio file.</Text>
          </CardBody>
        </Card>
      </Flex>
    </>
  );
});
