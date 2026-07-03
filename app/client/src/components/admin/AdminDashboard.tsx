import { FC, useState } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  useToast,
  Flex,
  Spacer,
  Input,
  FormControl,
  FormLabel,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardBody,
  CardHeader,
  Badge,
  Progress,
  Icon,
  Center,
  Wrap,
  WrapItem,
  Tag,
  TagLabel
} from '@chakra-ui/react';
import { useQuery } from 'react-query';
import { useApiService } from '../../hooks/useApiService';
import {
  FiUsers,
  FiVideo,
  FiDownload,
  FiFileText,
  FiTrendingUp,
  FiActivity,
  FiBarChart,
  FiPieChart,
  FiFolder
} from 'react-icons/fi';

interface IExportStat {
  _id: string;
  count: number;
}

interface IVideoStat {
  _id: string;
  count: number;
}

interface ILibraryStat {
  _id: string;
  count: number;
}

interface ISurveyData {
  surveys: unknown[];
  total: number;
}

interface IVideoData {
  videos: unknown[];
  total: number;
}

interface IPreuserPromptStats {
  totalCount: number;
  withLibrariesCount: number;
  withoutLibrariesCount: number;
}

interface ActivityLevel {
  level: string;
  count: number;
  percentage: number;
  color: string;
}

export const AdminDashboard: FC = () => {
  const [days, setDays] = useState<number | null>(28);
  const apiService = useApiService();
  const toast = useToast();

  // Fetch export stats
  const {
    data: exportData,
    isLoading: exportLoading,
    error: exportError
  } = useQuery({
    queryKey: ['dashboardExportStats', days],
    queryFn: async () => {
      try {
        return await apiService.get<IExportStat[]>(`/api/exports/stats/by-user?days=${days}`);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 401) {
          toast({
            title: 'Access Denied',
            description: 'This dashboard is only available in UAT environment',
            status: 'error',
            duration: 5000,
            isClosable: true
          });
        }
        throw err;
      }
    },
    enabled: days !== null && days > 0,
    retry: false
  });

  // Fetch video stats
  const { data: videoData, isLoading: videoLoading } = useQuery({
    queryKey: ['dashboardVideoStats', days],
    queryFn: async () => {
      return await apiService.get<IVideoStat[]>(`/api/videos/stats/by-user?days=${days}`);
    },
    enabled: days !== null && days > 0,
    retry: false
  });

  // Fetch library stats
  const { data: libraryData, isLoading: libraryLoading } = useQuery({
    queryKey: ['dashboardLibraryStats', days],
    queryFn: async () => {
      return await apiService.get<ILibraryStat[]>(`/api/library/stats/by-user?days=${days}`);
    },
    enabled: days !== null && days > 0,
    retry: false
  });

  // Fetch survey data (just total count)
  const { data: surveyData, isLoading: surveyLoading } = useQuery({
    queryKey: ['dashboardSurveyData'],
    queryFn: async () => {
      return await apiService.get<ISurveyData>('/api/survey/admin/all?skip=0&limit=1');
    },
    retry: false
  });

  // Fetch total video count
  const { data: totalVideoData, isLoading: totalVideoLoading } = useQuery({
    queryKey: ['dashboardTotalVideos'],
    queryFn: async () => {
      return await apiService.get<IVideoData>('/api/videos/admin/all?skip=0&limit=1');
    },
    retry: false
  });

  // Fetch preuser prompt stats
  const { data: preuserPromptData, isLoading: preuserPromptLoading } = useQuery({
    queryKey: ['dashboardPreuserPromptStats', days],
    queryFn: async () => {
      return await apiService.get<IPreuserPromptStats>(`/api/preuser-prompts/admin/stats?days=${days}`);
    },
    enabled: days !== null && days > 0,
    retry: false
  });

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setDays(null);
    } else {
      const newDays = parseInt(value);
      if (!isNaN(newDays) && newDays > 0) {
        setDays(newDays);
      }
    }
  };

  const isLoading =
    exportLoading || videoLoading || libraryLoading || surveyLoading || totalVideoLoading || preuserPromptLoading;

  // Calculate aggregated metrics
  const totalActiveExportUsers = exportData?.length || 0;
  const totalExports = exportData?.reduce((sum, stat) => sum + stat.count, 0) || 0;
  const averageExportsPerUser = totalActiveExportUsers > 0 ? (totalExports / totalActiveExportUsers).toFixed(1) : '0';
  const maxExports = exportData?.length ? Math.max(...exportData.map(stat => stat.count)) : 0;

  const totalActiveVideoUsers = videoData?.length || 0;
  const totalVideosInPeriod = videoData?.reduce((sum, stat) => sum + stat.count, 0) || 0;
  const averageVideosPerUser =
    totalActiveVideoUsers > 0 ? (totalVideosInPeriod / totalActiveVideoUsers).toFixed(1) : '0';
  const maxVideos = videoData?.length ? Math.max(...videoData.map(stat => stat.count)) : 0;

  const totalSurveys = surveyData?.total || 0;
  const totalVideosAllTime = totalVideoData?.total || 0;

  const totalPreuserPrompts = preuserPromptData?.totalCount || 0;
  const preuserPromptsWithLibraries = preuserPromptData?.withLibrariesCount || 0;
  const preuserPromptLibraryRate =
    totalPreuserPrompts > 0 ? ((preuserPromptsWithLibraries / totalPreuserPrompts) * 100).toFixed(1) : '0';

  const totalActiveLibraryUsers = libraryData?.length || 0;
  const totalLibrariesInPeriod = libraryData?.reduce((sum, stat) => sum + stat.count, 0) || 0;
  const averageLibrariesPerUser =
    totalActiveLibraryUsers > 0 ? (totalLibrariesInPeriod / totalActiveLibraryUsers).toFixed(1) : '0';
  const maxLibraries = libraryData?.length ? Math.max(...libraryData.map(stat => stat.count)) : 0;

  // Calculate export activity levels
  const exportActivityLevels: ActivityLevel[] = [
    {
      level: 'Light (1 export)',
      count: exportData?.filter(stat => stat.count === 1).length || 0,
      percentage: 0,
      color: 'green'
    },
    {
      level: 'Moderate (2-4 exports)',
      count: exportData?.filter(stat => stat.count >= 2 && stat.count <= 4).length || 0,
      percentage: 0,
      color: 'yellow'
    },
    {
      level: 'Active (5-9 exports)',
      count: exportData?.filter(stat => stat.count >= 5 && stat.count <= 9).length || 0,
      percentage: 0,
      color: 'orange'
    },
    {
      level: 'Very Active (10+ exports)',
      count: exportData?.filter(stat => stat.count >= 10).length || 0,
      percentage: 0,
      color: 'red'
    }
  ];

  // Calculate percentages
  exportActivityLevels.forEach(level => {
    level.percentage = totalActiveExportUsers > 0 ? (level.count / totalActiveExportUsers) * 100 : 0;
  });

  // Calculate video activity levels
  const videoActivityLevels: ActivityLevel[] = [
    {
      level: 'Light (1-4 videos)',
      count: videoData?.filter(stat => stat.count >= 1 && stat.count <= 4).length || 0,
      percentage: 0,
      color: 'green'
    },
    {
      level: 'Active (5-9 videos)',
      count: videoData?.filter(stat => stat.count >= 5 && stat.count <= 9).length || 0,
      percentage: 0,
      color: 'yellow'
    },
    {
      level: 'Very Active (10-19 videos)',
      count: videoData?.filter(stat => stat.count >= 10 && stat.count <= 19).length || 0,
      percentage: 0,
      color: 'orange'
    },
    {
      level: 'Super Active (20+ videos)',
      count: videoData?.filter(stat => stat.count >= 20).length || 0,
      percentage: 0,
      color: 'red'
    }
  ];

  // Calculate percentages
  videoActivityLevels.forEach(level => {
    level.percentage = totalActiveVideoUsers > 0 ? (level.count / totalActiveVideoUsers) * 100 : 0;
  });

  // Calculate library activity levels
  const libraryActivityLevels: ActivityLevel[] = [
    {
      level: 'Light (1 library)',
      count: libraryData?.filter(stat => stat.count === 1).length || 0,
      percentage: 0,
      color: 'green'
    },
    {
      level: 'Moderate (2 libraries)',
      count: libraryData?.filter(stat => stat.count === 2).length || 0,
      percentage: 0,
      color: 'yellow'
    },
    {
      level: 'Active (3-4 libraries)',
      count: libraryData?.filter(stat => stat.count >= 3 && stat.count <= 4).length || 0,
      percentage: 0,
      color: 'orange'
    },
    {
      level: 'Very Active (5+ libraries)',
      count: libraryData?.filter(stat => stat.count >= 5).length || 0,
      percentage: 0,
      color: 'purple'
    }
  ];

  // Calculate percentages
  libraryActivityLevels.forEach(level => {
    level.percentage = totalActiveLibraryUsers > 0 ? (level.count / totalActiveLibraryUsers) * 100 : 0;
  });

  // Calculate engagement metrics
  const exportToVideoRatio = totalVideosInPeriod > 0 ? ((totalExports / totalVideosInPeriod) * 100).toFixed(1) : '0';
  const surveyCompletionRate = totalVideosAllTime > 0 ? ((totalSurveys / totalVideosAllTime) * 100).toFixed(1) : '0';
  const libraryToVideoRatio =
    totalVideosInPeriod > 0 ? ((totalLibrariesInPeriod / totalVideosInPeriod) * 100).toFixed(1) : '0';
  const libraryUtilizationRate =
    totalActiveLibraryUsers > 0
      ? ((totalActiveLibraryUsers / Math.max(totalActiveVideoUsers, 1)) * 100).toFixed(1)
      : '0';

  if (exportError) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={4}>
          <Heading color="red.500">Access Denied</Heading>
          <Text>This dashboard is only available in UAT environment.</Text>
        </VStack>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Flex>
          <VStack align="start" spacing={2}>
            <HStack>
              <Icon as={FiBarChart} color="red.400" boxSize={8} />
              <Heading size="xl" color="red.400">
                🚀 Admin Analytics Dashboard
              </Heading>
            </HStack>
            <Text fontSize="lg" color="gray.600">
              Real-time insights and user activity metrics
              {days ? ` • Last ${days} days` : ' • Enter days to view stats'}
            </Text>
          </VStack>
          <Spacer />
          <HStack spacing={4}>
            <FormControl maxW="150px">
              <FormLabel fontSize="sm" color="gray.600">
                Time Period
              </FormLabel>
              <Input
                type="number"
                value={days || ''}
                onChange={handleDaysChange}
                min="1"
                size="md"
                bg="whiteAlpha.100"
                borderColor="gray.300"
                _hover={{ borderColor: 'red.300' }}
                _focus={{ borderColor: 'red.400', boxShadow: '0 0 0 1px var(--chakra-colors-red-400)' }}
                placeholder="Enter days"
              />
            </FormControl>
            <Button
              size="md"
              onClick={() => window.location.reload()}
              isLoading={isLoading}
              colorScheme="red"
              variant="outline"
              leftIcon={<Icon as={FiActivity} />}
              isDisabled={!days}
            >
              Refresh
            </Button>
          </HStack>
        </Flex>

        {/* Show message when no days selected */}
        {!days && (
          <Card bg="blue.50" borderLeft="4px" borderLeftColor="blue.400">
            <CardBody>
              <HStack>
                <Icon as={FiActivity} color="blue.400" />
                <Text color="blue.700">Enter a number of days above to view analytics data</Text>
              </HStack>
            </CardBody>
          </Card>
        )}

        {/* Only show the rest of the dashboard when days is set */}
        {days && (
          <>
            {/* Main KPI Cards */}
            <SimpleGrid columns={{ base: 2, md: 3, lg: 7 }} spacing={6}>
              <Card bg="gradient(135deg, #667eea 0%, #764ba2 100%)" color="white" boxShadow="xl">
                <CardBody>
                  <Stat>
                    <HStack>
                      <Icon as={FiUsers} boxSize={6} />
                      <StatLabel color="whiteAlpha.900" fontSize="sm" fontWeight="medium">
                        Active Export Users
                      </StatLabel>
                    </HStack>
                    <StatNumber fontSize="3xl" fontWeight="bold">
                      {totalActiveExportUsers}
                    </StatNumber>
                    <StatHelpText color="whiteAlpha.800">Users who exported in {days} days</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              <Card bg="gradient(135deg, #a8edea 0%, #fed6e3 100%)" color="white" boxShadow="xl">
                <CardBody>
                  <Stat>
                    <HStack>
                      <Icon as={FiUsers} boxSize={6} />
                      <StatLabel color="whiteAlpha.900" fontSize="sm" fontWeight="medium">
                        Total Video Creators
                      </StatLabel>
                    </HStack>
                    <StatNumber fontSize="3xl" fontWeight="bold">
                      {totalActiveVideoUsers}
                    </StatNumber>
                    <StatHelpText color="whiteAlpha.800">Users who created videos in {days} days</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              <Card bg="gradient(135deg, #f093fb 0%, #f5576c 100%)" color="white" boxShadow="xl">
                <CardBody>
                  <Stat>
                    <HStack>
                      <Icon as={FiDownload} boxSize={6} />
                      <StatLabel color="whiteAlpha.900" fontSize="sm" fontWeight="medium">
                        Total Exports
                      </StatLabel>
                    </HStack>
                    <StatNumber fontSize="3xl" fontWeight="bold">
                      {totalExports}
                    </StatNumber>
                    <StatHelpText color="whiteAlpha.800">{averageExportsPerUser} avg per user</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              <Card bg="gradient(135deg, #4facfe 0%, #00f2fe 100%)" color="white" boxShadow="xl">
                <CardBody>
                  <Stat>
                    <HStack>
                      <Icon as={FiVideo} boxSize={6} />
                      <StatLabel color="whiteAlpha.900" fontSize="sm" fontWeight="medium">
                        Videos Created
                      </StatLabel>
                    </HStack>
                    <StatNumber fontSize="3xl" fontWeight="bold">
                      {totalVideosInPeriod}
                    </StatNumber>
                    <StatHelpText color="whiteAlpha.800">{averageVideosPerUser} avg per user</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              <Card bg="gradient(135deg, #fa709a 0%, #fee140 100%)" color="white" boxShadow="xl">
                <CardBody>
                  <Stat>
                    <HStack>
                      <Icon as={FiFileText} boxSize={6} />
                      <StatLabel color="whiteAlpha.900" fontSize="sm" fontWeight="medium">
                        Survey Responses
                      </StatLabel>
                    </HStack>
                    <StatNumber fontSize="3xl" fontWeight="bold">
                      {totalSurveys}
                    </StatNumber>
                    <StatHelpText color="whiteAlpha.800">{surveyCompletionRate}% completion rate</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              <Card bg="gradient(135deg, #ff9a9e 0%, #fecfef 100%)" color="white" boxShadow="xl">
                <CardBody>
                  <Stat>
                    <HStack>
                      <Icon as={FiFolder} boxSize={6} />
                      <StatLabel color="whiteAlpha.900" fontSize="sm" fontWeight="medium">
                        Libraries Created
                      </StatLabel>
                    </HStack>
                    <StatNumber fontSize="3xl" fontWeight="bold">
                      {totalLibrariesInPeriod}
                    </StatNumber>
                    <StatHelpText color="whiteAlpha.800">{averageLibrariesPerUser} avg per user</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              <Card bg="gradient(135deg, #30cfd0 0%, #330867 100%)" color="white" boxShadow="xl">
                <CardBody>
                  <Stat>
                    <HStack>
                      <Icon as={FiFileText} boxSize={6} />
                      <StatLabel color="whiteAlpha.900" fontSize="sm" fontWeight="medium">
                        Preuser Prompts
                      </StatLabel>
                    </HStack>
                    <StatNumber fontSize="3xl" fontWeight="bold">
                      {totalPreuserPrompts}
                    </StatNumber>
                    <StatHelpText color="whiteAlpha.800">{preuserPromptLibraryRate}% with libraries</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
            </SimpleGrid>

            {/* Engagement Metrics */}
            <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={6}>
              <Card boxShadow="lg" borderTop="4px" borderTopColor="purple.400">
                <CardHeader pb={2}>
                  <HStack>
                    <Icon as={FiTrendingUp} color="purple.400" />
                    <Heading size="md" color="gray.700">
                      Export Conversion
                    </Heading>
                  </HStack>
                </CardHeader>
                <CardBody pt={0}>
                  <VStack align="start">
                    <Text fontSize="3xl" fontWeight="bold" color="purple.600">
                      {exportToVideoRatio}%
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Videos that get exported
                    </Text>
                    <Progress
                      value={parseFloat(exportToVideoRatio)}
                      max={100}
                      w="100%"
                      colorScheme="purple"
                      size="sm"
                      borderRadius="full"
                    />
                  </VStack>
                </CardBody>
              </Card>

              <Card boxShadow="lg" borderTop="4px" borderTopColor="blue.400">
                <CardHeader pb={2}>
                  <HStack>
                    <Icon as={FiActivity} color="blue.400" />
                    <Heading size="md" color="gray.700">
                      Peak Activity
                    </Heading>
                  </HStack>
                </CardHeader>
                <CardBody pt={0}>
                  <VStack align="start">
                    <Text fontSize="3xl" fontWeight="bold" color="blue.600">
                      {Math.max(maxExports, maxVideos, maxLibraries)}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Max actions by single user
                    </Text>
                    <Wrap spacing={1}>
                      <Badge colorScheme="blue" variant="subtle" size="sm">
                        {maxExports} exports
                      </Badge>
                      <Badge colorScheme="cyan" variant="subtle" size="sm">
                        {maxVideos} videos
                      </Badge>
                      <Badge colorScheme="purple" variant="subtle" size="sm">
                        {maxLibraries} libraries
                      </Badge>
                    </Wrap>
                  </VStack>
                </CardBody>
              </Card>

              <Card boxShadow="lg" borderTop="4px" borderTopColor="green.400">
                <CardHeader pb={2}>
                  <HStack>
                    <Icon as={FiPieChart} color="green.400" />
                    <Heading size="md" color="gray.700">
                      User Engagement
                    </Heading>
                  </HStack>
                </CardHeader>
                <CardBody pt={0}>
                  <VStack align="start">
                    <Text fontSize="3xl" fontWeight="bold" color="green.600">
                      {((totalActiveExportUsers + totalActiveVideoUsers + totalActiveLibraryUsers) / 3).toFixed(0)}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Avg active users/period
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Based on all platform activity
                    </Text>
                  </VStack>
                </CardBody>
              </Card>

              <Card boxShadow="lg" borderTop="4px" borderTopColor="orange.400">
                <CardHeader pb={2}>
                  <HStack>
                    <Icon as={FiFolder} color="orange.400" />
                    <Heading size="md" color="gray.700">
                      Library Adoption
                    </Heading>
                  </HStack>
                </CardHeader>
                <CardBody pt={0}>
                  <VStack align="start">
                    <Text fontSize="3xl" fontWeight="bold" color="orange.600">
                      {libraryUtilizationRate}%
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Video creators using libraries
                    </Text>
                    <Progress
                      value={parseFloat(libraryUtilizationRate)}
                      max={100}
                      w="100%"
                      colorScheme="orange"
                      size="sm"
                      borderRadius="full"
                    />
                  </VStack>
                </CardBody>
              </Card>

              <Card boxShadow="lg" borderTop="4px" borderTopColor="pink.400">
                <CardHeader pb={2}>
                  <HStack>
                    <Icon as={FiTrendingUp} color="pink.400" />
                    <Heading size="md" color="gray.700">
                      Content Pipeline
                    </Heading>
                  </HStack>
                </CardHeader>
                <CardBody pt={0}>
                  <VStack align="start">
                    <Text fontSize="3xl" fontWeight="bold" color="pink.600">
                      {libraryToVideoRatio}%
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Libraries per video created
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Content preparation ratio
                    </Text>
                  </VStack>
                </CardBody>
              </Card>
            </SimpleGrid>

            {/* Activity Distribution */}
            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={8}>
              {/* Export Activity Levels */}
              <Card boxShadow="lg">
                <CardHeader>
                  <HStack>
                    <Icon as={FiDownload} color="red.400" />
                    <Heading size="md" color="gray.700">
                      Export Activity Distribution
                    </Heading>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    {exportActivityLevels.map((level, index) => (
                      <Box key={index}>
                        <Flex justify="space-between" mb={2}>
                          <Text fontSize="sm" color="gray.600">
                            {level.level}
                          </Text>
                          <Text fontSize="sm" fontWeight="bold" color="gray.700">
                            {level.count} users ({level.percentage.toFixed(1)}%)
                          </Text>
                        </Flex>
                        <Progress
                          value={level.percentage}
                          max={100}
                          colorScheme={level.color}
                          size="md"
                          borderRadius="full"
                        />
                      </Box>
                    ))}
                  </VStack>
                </CardBody>
              </Card>

              {/* Video Activity Levels */}
              <Card boxShadow="lg">
                <CardHeader>
                  <HStack>
                    <Icon as={FiVideo} color="blue.400" />
                    <Heading size="md" color="gray.700">
                      Video Creation Distribution
                    </Heading>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    {videoActivityLevels.map((level, index) => (
                      <Box key={index}>
                        <Flex justify="space-between" mb={2}>
                          <Text fontSize="sm" color="gray.600">
                            {level.level}
                          </Text>
                          <Text fontSize="sm" fontWeight="bold" color="gray.700">
                            {level.count} users ({level.percentage.toFixed(1)}%)
                          </Text>
                        </Flex>
                        <Progress
                          value={level.percentage}
                          max={100}
                          colorScheme={level.color}
                          size="md"
                          borderRadius="full"
                        />
                      </Box>
                    ))}
                  </VStack>
                </CardBody>
              </Card>

              {/* Library Activity Levels */}
              <Card boxShadow="lg">
                <CardHeader>
                  <HStack>
                    <Icon as={FiFolder} color="purple.400" />
                    <Heading size="md" color="gray.700">
                      Library Creation Distribution
                    </Heading>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    {libraryActivityLevels.map((level, index) => (
                      <Box key={index}>
                        <Flex justify="space-between" mb={2}>
                          <Text fontSize="sm" color="gray.600">
                            {level.level}
                          </Text>
                          <Text fontSize="sm" fontWeight="bold" color="gray.700">
                            {level.count} users ({level.percentage.toFixed(1)}%)
                          </Text>
                        </Flex>
                        <Progress
                          value={level.percentage}
                          max={100}
                          colorScheme={level.color}
                          size="md"
                          borderRadius="full"
                        />
                      </Box>
                    ))}
                  </VStack>
                </CardBody>
              </Card>
            </SimpleGrid>

            {/* Summary Insights */}
            <Card boxShadow="xl" borderLeft="6px" borderLeftColor="red.400">
              <CardHeader>
                <HStack>
                  <Icon as={FiBarChart} color="red.400" boxSize={6} />
                  <Heading size="md" color="gray.50">
                    📊 Key Insights
                  </Heading>
                </HStack>
              </CardHeader>
              <CardBody>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                  <VStack align="start" spacing={3}>
                    <Heading size="sm" color="gray.50">
                      User Behavior
                    </Heading>
                    <Wrap spacing={2}>
                      <WrapItem>
                        <Tag colorScheme="blue" size="lg">
                          <TagLabel>{totalActiveVideoUsers} video creators</TagLabel>
                        </Tag>
                      </WrapItem>
                      <WrapItem>
                        <Tag colorScheme="red" size="lg">
                          <TagLabel>{totalActiveExportUsers} exporters</TagLabel>
                        </Tag>
                      </WrapItem>
                      <WrapItem>
                        <Tag colorScheme="purple" size="lg">
                          <TagLabel>{totalActiveLibraryUsers} library builders</TagLabel>
                        </Tag>
                      </WrapItem>
                    </Wrap>
                  </VStack>
                  <VStack align="start" spacing={3}>
                    <Heading size="sm" color="gray.50">
                      Content Pipeline
                    </Heading>
                    <Wrap spacing={2}>
                      <WrapItem>
                        <Tag colorScheme="green" size="lg">
                          <TagLabel>{exportToVideoRatio}% export rate</TagLabel>
                        </Tag>
                      </WrapItem>
                      <WrapItem>
                        <Tag colorScheme="orange" size="lg">
                          <TagLabel>{libraryToVideoRatio}% library prep rate</TagLabel>
                        </Tag>
                      </WrapItem>
                      <WrapItem>
                        <Tag colorScheme="pink" size="lg">
                          <TagLabel>{libraryUtilizationRate}% library adoption</TagLabel>
                        </Tag>
                      </WrapItem>
                    </Wrap>
                  </VStack>
                  <VStack align="start" spacing={3}>
                    <Heading size="sm" color="gray.50">
                      Platform Health
                    </Heading>
                    <Wrap spacing={2}>
                      <WrapItem>
                        <Tag colorScheme="purple" size="lg">
                          <TagLabel>{totalVideosAllTime} total videos</TagLabel>
                        </Tag>
                      </WrapItem>
                      <WrapItem>
                        <Tag colorScheme="teal" size="lg">
                          <TagLabel>{totalLibrariesInPeriod} libraries created</TagLabel>
                        </Tag>
                      </WrapItem>
                      <WrapItem>
                        <Tag colorScheme="cyan" size="lg">
                          <TagLabel>{surveyCompletionRate}% survey rate</TagLabel>
                        </Tag>
                      </WrapItem>
                    </Wrap>
                  </VStack>
                </SimpleGrid>
              </CardBody>
            </Card>

            {/* Quick Navigation */}
            <Card boxShadow="lg" borderLeft="6px" borderLeftColor="blue.400">
              <CardHeader>
                <Heading size="md" color="gray.50">
                  🔗 Quick Navigation
                </Heading>
              </CardHeader>
              <CardBody pt={0}>
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                  <Button
                    as="a"
                    href="/admin/videos"
                    size="md"
                    colorScheme="blue"
                    variant="outline"
                    leftIcon={<Icon as={FiVideo} />}
                  >
                    All Videos
                  </Button>
                  <Button
                    as="a"
                    href="/admin/libraries"
                    size="md"
                    colorScheme="purple"
                    variant="outline"
                    leftIcon={<Icon as={FiFolder} />}
                  >
                    All Libraries
                  </Button>
                  <Button
                    as="a"
                    href="/admin/surveys"
                    size="md"
                    colorScheme="green"
                    variant="outline"
                    leftIcon={<Icon as={FiFileText} />}
                  >
                    Surveys
                  </Button>
                  <Button
                    as="a"
                    href="/admin/exports"
                    size="md"
                    colorScheme="red"
                    variant="outline"
                    leftIcon={<Icon as={FiDownload} />}
                  >
                    Export Details
                  </Button>
                  <Button
                    as="a"
                    href="/admin/video-stats"
                    size="md"
                    colorScheme="purple"
                    variant="outline"
                    leftIcon={<Icon as={FiUsers} />}
                  >
                    Video Details
                  </Button>
                  <Button
                    as="a"
                    href="/admin/library-stats"
                    size="md"
                    colorScheme="orange"
                    variant="outline"
                    leftIcon={<Icon as={FiFolder} />}
                  >
                    Library Details
                  </Button>
                  <Button
                    as="a"
                    href="/admin/automations"
                    size="md"
                    colorScheme="teal"
                    variant="outline"
                    leftIcon={<Icon as={FiActivity} />}
                  >
                    All Automations
                  </Button>
                  <Button
                    as="a"
                    href="/admin/preuser-prompts"
                    size="md"
                    colorScheme="cyan"
                    variant="outline"
                    leftIcon={<Icon as={FiFileText} />}
                  >
                    Preuser Prompts
                  </Button>
                  <Button
                    as="a"
                    href="/admin/chats"
                    size="md"
                    colorScheme="teal"
                    variant="outline"
                    leftIcon={<Icon as={FiFileText} />}
                  >
                    User Chats
                  </Button>
                </SimpleGrid>
              </CardBody>
            </Card>
          </>
        )}

        <Center>
          <Text fontSize="sm" color="gray.400" fontStyle="italic">
            🔒 UAT Environment Only • Real-time data updates every refresh
          </Text>
        </Center>
      </VStack>
    </Container>
  );
};
