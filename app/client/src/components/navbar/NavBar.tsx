import React, { FC, PropsWithChildren } from 'react';
import { Link, Box, Flex, Text, Button, Stack, ChakraProps } from '@chakra-ui/react';
import { IoMdClose } from 'react-icons/io';
import Logo from './Logo';
import { NavLink, Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useFirebaseAuthenticationService } from '../../contexts/firebase/hooks';
import { FaFolderPlus, FaPlus } from 'react-icons/fa';
import NotificationButton from './NotificationButton';
import { BiSolidVideoPlus } from 'react-icons/bi';

const NavBar: FC = props => {
  const [isOpen, setIsOpen] = React.useState(false);
  const toggle = () => setIsOpen(!isOpen);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useFirebaseAuthenticationService();

  const handleSwitchAccount = () => {
    logout();
    navigate('/login');
  };

  // Check if user is in onboarding mode
  const isOnboarding = new URLSearchParams(location.search).get('onboarding') === 'true';

  return (
    <>
      <NavBarContainer
        {...props}
        isOpen={isOpen}
        isOnboarding={isOnboarding}
        onSwitchAccount={handleSwitchAccount}
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent={{ base: 'space-between', lg: 'flex-start' }}
          w={{ base: '100%', lg: 'auto' }}
          flex={{ base: '1', lg: '0 1 auto' }}
          gap={6}
        >
          <Link as={RouterLink} to="/" _hover={{ textDecoration: 'none' }}>
            <Logo color={'blue.800'} />
          </Link>
          <MenuLinks />
          <MenuToggle toggle={toggle} isOpen={isOpen} />
        </Box>

        <Flex gap={3} display={{ base: 'none', lg: 'flex' }} alignItems="center">
          <Button
            size="md"
            variant="ghost"
            rounded="md"
            onClick={handleSwitchAccount}
          >
            Switch account
          </Button>
          <NotificationButton />

          <MenuItem to="/library/add" opacity={1}>
            <Button
              size="md"
              rounded="md"
              className="newlibrary"
              isDisabled={isOnboarding}
              variant="outline"
              colorScheme="white"
              leftIcon={<FaFolderPlus size={16} />}
            >
              Library
            </Button>
          </MenuItem>
          <MenuItem to="/upload?type=script" opacity={1}>
            <Button
              size="md"
              id="newproject"
              className="newproject"
              rounded="md"
              isDisabled={isOnboarding}
              colorScheme="white"
              bg="white"
              leftIcon={<BiSolidVideoPlus size={20} />}
            >
              Project
            </Button>
          </MenuItem>
          <MenuItem to="/automation-configs/new" opacity={1}>
            <Button
              size="md"
              rounded="md"
              isDisabled={isOnboarding}
              colorScheme="white"
              bg="white"
              leftIcon={<FaPlus size={16} />}
            >
              Automation
            </Button>
          </MenuItem>
        </Flex>
      </NavBarContainer>
    </>
  );
};

const CloseIcon = () => <IoMdClose />;

const MenuIcon = () => (
  <svg width="24px" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" fill="#2A4365">
    <title>Menu</title>
    <path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z" />
  </svg>
);

const MenuToggle: FC<{ toggle: () => void; isOpen: boolean }> = ({ toggle, isOpen }) => {
  return (
    <Box display={{ base: 'block', lg: 'none' }} onClick={toggle}>
      {isOpen ? <CloseIcon /> : <MenuIcon />}
    </Box>
  );
};

const MenuItem: FC<PropsWithChildren<{ to: string; opacity?: number; display?: ChakraProps['display'] }>> = ({
  children,
  to = '/',
  opacity,
  display,
  ...rest
}) => {
  return (
    <Link
      as={NavLink}
      to={to}
      cursor="pointer"
      color="white"
      opacity={opacity ?? 0.5}
      fontFamily="IBM Plex Sans Hebrew, sans-serif"
      fontSize="15px"
      _hover={{ opacity: 1, color: 'white' }}
      display={display}
      _activeLink={{ opacity: 1, fontWeight: 600 }}
    >
      <Text display="block" {...rest}>
        {children}
      </Text>
    </Link>
  );
};

const MenuLinks: FC = () => {
  return (
    <Box display={{ base: 'none', lg: 'block' }} flexBasis={{ base: '100%', lg: 'auto' }}>
      <Stack spacing={8} align="center" justify="flex-end" direction="row">
        <MenuItem to="/videos">My Projects</MenuItem>
        <MenuItem to="/libraries">My Libraries</MenuItem>
        <MenuItem to="/automation-configs">My Automations</MenuItem>
        <MenuItem to="/youtube">YouTube</MenuItem>
      </Stack>
    </Box>
  );
};

const NavBarContainer: FC<
  PropsWithChildren<{
    isOpen?: boolean;
    isOnboarding?: boolean;
    onSwitchAccount?: () => void;
  }>
> = ({ children, isOpen, isOnboarding, onSwitchAccount, ...props }) => {
  return (
    <Box position="relative" w="100%">
      <Flex
        as="nav"
        align="center"
        justify="space-between"
        wrap={{ base: 'wrap', lg: 'nowrap' }}
        w="100%"
        flexGrow={0}
        paddingX={{ base: 4, md: 8 }}
        paddingY={2}
        bg="whiteAlpha.100"
        gap={4}
        {...props}
      >
        {children}
      </Flex>

      {/* Mobile menu - dropdown overlay */}
      <Box
        display={{ base: isOpen ? 'block' : 'none', lg: 'none' }}
        position="absolute"
        top="100%"
        left={0}
        right={0}
        bg="gray.800"
        borderTop="1px solid"
        borderColor="whiteAlpha.200"
        zIndex={1000}
        pt={4}
        pb={6}
        px={4}
      >
        <Stack spacing={4} textAlign="center" align="stretch" direction="column">
          <MenuItem to="/videos">My Projects</MenuItem>
          <MenuItem to="/libraries">My Libraries</MenuItem>
          <MenuItem to="/automation-configs">My Automations</MenuItem>
          <MenuItem to="/youtube">YouTube</MenuItem>
          {onSwitchAccount && (
            <Text
              color="white"
              py={2}
              cursor="pointer"
              onClick={onSwitchAccount}
              _hover={{ opacity: 1 }}
            >
              Switch account
            </Text>
          )}

          <MenuItem to="/library/add" opacity={1}>
            <Button
              size="md"
              rounded="md"
              colorScheme="white"
              variant="outline"
              isDisabled={isOnboarding}
              leftIcon={<FaPlus size={16} />}
              w="100%"
            >
              Library
            </Button>
          </MenuItem>
          <MenuItem to="/upload?type=script" opacity={1}>
            <Button
              size="md"
              rounded="md"
              isDisabled={isOnboarding}
              colorScheme="white"
              bg="white"
              leftIcon={<FaPlus size={16} />}
              w="100%"
            >
              Project
            </Button>
          </MenuItem>
          <MenuItem to="/automation-configs/new" opacity={1}>
            <Button
              size="md"
              rounded="md"
              isDisabled={isOnboarding}
              colorScheme="white"
              bg="white"
              leftIcon={<FaPlus size={16} />}
              w="100%"
            >
              Automation
            </Button>
          </MenuItem>
        </Stack>
      </Box>
    </Box>
  );
};

export default NavBar;
