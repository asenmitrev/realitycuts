import { IconButton, Menu, MenuButton, MenuList, MenuItem, MenuDivider, Text, Box, Circle, Spinner } from '@chakra-ui/react';
import { BsBell } from 'react-icons/bs';
import { useApiService } from '../../hooks/useApiService';
import { useUserId } from '../../contexts/firebase/hooks';
import { useQuery } from 'react-query';
import { INotification } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function NotificationButton() {
  const apiService = useApiService();
  const userId = useUserId();
  const navigate = useNavigate();
  const [isReadingAll, setIsReadingAll] = useState(false);
  const {
    data: count,
    refetch: refetchCount,
    isLoading: isLoadingCount
  } = useQuery({
    refetchInterval: 15000,
    queryKey: ['notifications-count', userId],
    queryFn: () => apiService.get<{ count: number }>('/api/notifications/count')
  });

  const { data: notifications, refetch: refetchNotifications } = useQuery({
    enabled: false,
    queryKey: ['notifications', userId],
    queryFn: () => apiService.get<INotification[]>('/api/notifications')
  });

  return (
    <Menu placement="bottom-end">
      <MenuButton
        as={IconButton}
        aria-label="Notifications"
        icon={
          <Box position="relative">
            <BsBell size={20} />
            {count && count.count > 0 && (
              <Circle size="2" bg="red.500" position="absolute" top={0} right={0} transform="translate(25%, -25%)" />
            )}
          </Box>
        }
        variant="ghost"
        _hover={{ bg: 'whiteAlpha.200' }}
        _active={{ bg: 'whiteAlpha.300' }}
        bg="transparent"
        onClick={async () => {
          await refetchNotifications();
          await refetchCount();
        }}
        color="white"
      />
      <MenuList bg="gray.900" borderColor="whiteAlpha.200" py={2} w="400px">
        <Box display="flex" justifyContent="space-between" alignItems="center" px={4} py={2}>
          <Text fontWeight="medium" color="white">
            Notifications
          </Text>
          {notifications?.length ? (
            <Box
              color={isReadingAll ? 'whiteAlpha.500' : 'blue.300'}
              fontSize="xs"
              cursor={isReadingAll ? 'not-allowed' : 'pointer'}
              _hover={isReadingAll ? undefined : { color: 'blue.200' }}
              onClick={async (e) => {
                if (isReadingAll) return;
                e.stopPropagation();
                setIsReadingAll(true);
                try {
                  await apiService.post('/api/notifications/read-all');
                  await refetchNotifications();
                  await refetchCount();
                } finally {
                  setIsReadingAll(false);
                }
              }}
            >
              {isReadingAll ? (
                <Box display="flex" alignItems="center" gap={1}>
                  <Spinner size="xs" color="blue.300" />
                  <span>Reading...</span>
                </Box>
              ) : (
                'Read all'
              )}
            </Box>
          ) : null}
        </Box>
        <MenuDivider borderColor="whiteAlpha.200" />
        {isLoadingCount ? (
          <MenuItem>Loading...</MenuItem>
        ) : notifications?.length ? (
          notifications?.map(notification => (
            <MenuItem
              key={notification._id}
              py={3}
              px={4}
              _hover={{ bg: 'whiteAlpha.100' }}
              _focus={{ bg: 'whiteAlpha.100' }}
              bg={!notification.isRead ? 'whiteAlpha.200' : 'whiteAlpha.200'}
              onClick={() => {
                if (notification.links?.[0]) {
                  const path =
                    notification.links[0].linkType === 'VIDEO'
                      ? `/videos/${notification.links[0].docId}`
                      : notification.links[0].linkType === 'LIBRARY'
                      ? `/libraries/${notification.links[0].docId}`
                      : `/exports/${notification.links[0].docId}`;
                  navigate(path);
                }
              }}
            >
              <Box>
                <Text color="white" fontSize="sm" as="div" fontWeight="medium">
                  {notification.title}
                  {!notification.isRead && <Circle size="2" bg="blue.400" display="inline-block" ml={2} />}
                </Text>
                <Text color="whiteAlpha.700" fontSize="xs">
                  {notification.message}
                </Text>
              </Box>
            </MenuItem>
          ))
        ) : (
          <MenuItem>No notifications</MenuItem>
        )}
      </MenuList>
    </Menu>
  );
}
