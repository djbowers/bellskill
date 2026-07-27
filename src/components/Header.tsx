import { SunIcon } from '@radix-ui/react-icons';
import { NavLink } from 'react-router-dom';

import { useFeatures } from '~/hooks';
import { handleClickLightDarkMode, handleSignOut } from '~/lib/nav-actions';

import './Header.styles.css';
import { Button } from './ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from './ui/navigation-menu';
import { Separator } from './ui/separator';

export const Header = () => {
  const features = useFeatures();

  return (
    <NavigationMenu
      className={
        features.bottomNav
          ? // Bottom bar owns mobile nav; keep the top nav for desktop only.
            'hidden grid-cols-1 sm:grid sm:grid-cols-3'
          : 'grid grid-cols-1 sm:grid-cols-3'
      }
    >
      <NavigationMenuList>
        <NavigationMenuItem className="mr-auto">
          <NavigationMenuTrigger className="flex items-center gap-1">
            <img
              src="/favicon.svg"
              alt="BellSkill Logo"
              className="h-2.5 w-2.5"
            />
            <h1 className="text-lg font-medium">BellSkill</h1>
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink
              asChild
              className={navigationMenuTriggerStyle()}
            >
              <NavLink to="/account">Account</NavLink>
            </NavigationMenuLink>
            <Separator />
            <NavigationMenuLink
              asChild
              className={navigationMenuTriggerStyle()}
            >
              <span onClick={handleSignOut}>Sign Out</span>
            </NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <Button
          className="ml-auto block sm:hidden"
          onClick={handleClickLightDarkMode}
          size="icon"
          variant="ghost"
        >
          <SunIcon />
        </Button>
      </NavigationMenuList>

      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <NavLink to="/">Start</NavLink>
          </NavigationMenuLink>
        </NavigationMenuItem>
        {features.programs && (
          <NavigationMenuItem>
            <NavigationMenuLink
              asChild
              className={navigationMenuTriggerStyle()}
            >
              <NavLink to="/programs">Programs</NavLink>
            </NavigationMenuLink>
          </NavigationMenuItem>
        )}
        {features.explore && (
          <NavigationMenuItem>
            <NavigationMenuLink
              asChild
              className={navigationMenuTriggerStyle()}
            >
              <NavLink to="/movements">Explore</NavLink>
            </NavigationMenuLink>
          </NavigationMenuItem>
        )}
        {features.premium && (
          <NavigationMenuItem>
            <NavigationMenuLink
              asChild
              className={navigationMenuTriggerStyle()}
            >
              <NavLink to="/recommendations">AI</NavLink>
            </NavigationMenuLink>
          </NavigationMenuItem>
        )}
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <NavLink to="/history">History</NavLink>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>

      <Button
        className="ml-auto hidden sm:block"
        onClick={handleClickLightDarkMode}
        size="icon"
        variant="ghost"
      >
        <SunIcon />
      </Button>
    </NavigationMenu>
  );
};
