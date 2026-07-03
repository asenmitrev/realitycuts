import { FC, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  FormLabel,
  FormErrorMessage,
  FormControl,
  Heading,
  Input,
  RadioGroup,
  Radio,
  Stack,
  Checkbox,
  CheckboxGroup,
  Text,
  Box,
  HStack
} from '@chakra-ui/react';
import { FormProvider, useForm, Controller } from 'react-hook-form';
import { useApiService } from '../../hooks/useApiService';

interface SurveyFormData {
  userType: 'solo_creator' | 'marketing_professional' | 'business_owner' | 'agency_freelancer' | 'other';
  userTypeOther: string;
  usageTypes: ('youtube_videos' | 'business_promotion' | 'tiktok_instagram' | 'educational_videos' | 'other')[];
  usageTypesOther: string;
}

interface SurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export const SurveyModal: FC<SurveyModalProps> = ({ isOpen, onClose, onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const apiService = useApiService();

  const methods = useForm<SurveyFormData>({
    defaultValues: {
      userType: 'solo_creator',
      userTypeOther: '',
      usageTypes: [],
      usageTypesOther: ''
    }
  });

  const {
    handleSubmit,
    register,
    watch,
    control,
    formState: { errors }
  } = methods;

  const userType = watch('userType');
  const usageTypes = watch('usageTypes');

  const onSubmit = async (data: SurveyFormData) => {
    setIsLoading(true);
    try {
      await apiService.post('/api/survey', data);
      onComplete?.();
      onClose();
    } catch (error) {
      console.error('Error submitting survey:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="2xl" closeOnOverlayClick={false}>
      <ModalOverlay backdropFilter="blur(5px)" />
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalContent>
            <ModalHeader borderBottomWidth="1px" pb={4}>
              <Heading size="lg" fontWeight="bold">
                Quick Survey
              </Heading>
              <Text fontSize="sm" color="gray.300" mt={2}>
                Help us personalize your experience with just 2 quick questions
              </Text>
            </ModalHeader>
            <ModalCloseButton top={4} right={4} />

            <ModalBody py={6}>
              <HStack spacing={8} align="stretch">
                {/* Question 1: User Type */}
                <FormControl isInvalid={!!errors.userType}>
                  <FormLabel fontSize="md" fontWeight="medium" mb={4}>
                    What best describes you?
                  </FormLabel>
                  <Controller
                    name="userType"
                    control={control}
                    rules={{ required: 'Please select an option' }}
                    render={({ field }) => (
                      <RadioGroup {...field} colorScheme="white">
                        <Stack spacing={3}>
                          <Radio value="solo_creator">Solo creator</Radio>
                          <Radio value="marketing_professional">Marketing professional</Radio>
                          <Radio value="business_owner">Business owner</Radio>
                          <Radio value="agency_freelancer">Agency / freelancer</Radio>
                          <Radio value="other">Other</Radio>
                        </Stack>
                      </RadioGroup>
                    )}
                  />
                  <FormErrorMessage>{errors.userType?.message}</FormErrorMessage>

                  {userType === 'other' && (
                    <Box mt={3}>
                      <Input
                        {...register('userTypeOther', {
                          required: userType === 'other' ? 'Please specify' : false
                        })}
                        placeholder="Please specify..."
                        size="sm"
                      />
                      {errors.userTypeOther && (
                        <Text color="red.400" fontSize="sm" mt={1}>
                          {errors.userTypeOther.message}
                        </Text>
                      )}
                    </Box>
                  )}
                </FormControl>

                {/* Question 2: Usage Types */}
                <FormControl isInvalid={!!errors.usageTypes}>
                  <FormLabel fontSize="md" fontWeight="medium" mb={4}>
                    What do you plan to use RealityCuts for?
                    <Text fontSize="sm" color="gray.400" fontWeight="normal">
                      (Select all that apply)
                    </Text>
                  </FormLabel>
                  <Controller
                    name="usageTypes"
                    control={control}
                    rules={{
                      required: 'Please select at least one option',
                      validate: value => (value && value.length > 0) || 'Please select at least one option'
                    }}
                    render={({ field }) => (
                      <CheckboxGroup
                        value={field.value}
                        onChange={values => field.onChange(values)}
                        colorScheme="white"
                      >
                        <Stack spacing={3}>
                          <Checkbox id="youtube_videos" value="youtube_videos">
                            Creating YouTube videos
                          </Checkbox>
                          <Checkbox id="business_promotion" value="business_promotion">
                            Promoting my business/service
                          </Checkbox>
                          <Checkbox id="tiktok_instagram" value="tiktok_instagram">
                            Posting content on TikTok/Instagram
                          </Checkbox>
                          <Checkbox id="educational_videos" value="educational_videos">
                            Educational videos
                          </Checkbox>
                          <Checkbox id="other" value="other">
                            Something else
                          </Checkbox>
                        </Stack>
                      </CheckboxGroup>
                    )}
                  />
                  <FormErrorMessage>{errors.usageTypes?.message}</FormErrorMessage>

                  {usageTypes?.includes('other') && (
                    <Box mt={3}>
                      <Input
                        {...register('usageTypesOther', {
                          required: usageTypes?.includes('other') ? 'Please specify' : false
                        })}
                        placeholder="Please specify..."
                        size="sm"
                      />
                      {errors.usageTypesOther && (
                        <Text color="red.400" fontSize="sm" mt={1}>
                          {errors.usageTypesOther.message}
                        </Text>
                      )}
                    </Box>
                  )}
                </FormControl>
              </HStack>
            </ModalBody>

            <ModalFooter borderTopWidth="1px" pt={4} justifyContent="flex-end">
              <Button colorScheme="white" isLoading={isLoading} type="submit" size="lg" minW="120px">
                Submit
              </Button>
            </ModalFooter>
          </ModalContent>
        </form>
      </FormProvider>
    </Modal>
  );
};
