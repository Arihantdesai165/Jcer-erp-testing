import React, { useState, useEffect } from 'react';
import { User as UserIcon } from 'lucide-react';
import { getAvatarUrl, getInitials } from '../../utils/avatar.util';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';

export interface ProfileAvatarProps {
  imageUrl?: string | null;
  name?: string | null;
  size?: AvatarSize;
  className?: string;
  imgClassName?: string;
  fallbackType?: 'initials' | 'icon';
  roundedClassName?: string;
  alt?: string;
  onClick?: () => void;
}

const sizeClasses: Record<Exclude<AvatarSize, 'custom'>, { container: string; text: string; icon: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]', icon: 'w-3 h-3' },
  sm: { container: 'w-8 h-8', text: 'text-xs', icon: 'w-4 h-4' },
  md: { container: 'w-10 h-10', text: 'text-sm', icon: 'w-5 h-5' },
  lg: { container: 'w-12 h-12', text: 'text-base', icon: 'w-6 h-6' },
  xl: { container: 'w-16 h-16', text: 'text-xl', icon: 'w-8 h-8' },
  '2xl': { container: 'w-24 h-24', text: 'text-2xl', icon: 'w-10 h-10' },
};

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  imageUrl,
  name,
  size = 'md',
  className = '',
  imgClassName = '',
  fallbackType = 'initials',
  roundedClassName = 'rounded-full',
  alt,
  onClick,
}) => {
  const [hasError, setHasError] = useState(false);
  const resolvedUrl = getAvatarUrl(imageUrl);

  // Reset error state when imageUrl changes
  useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  const sizeConfig = size !== 'custom' ? sizeClasses[size] : { container: '', text: '', icon: '' };
  const initials = getInitials(name);
  const displayName = name || 'User';

  const showImage = Boolean(resolvedUrl && !hasError);

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none ${
        sizeConfig.container
      } ${roundedClassName} ${
        showImage
          ? 'bg-neutral-100 dark:bg-neutral-800'
          : 'bg-gradient-to-br from-indigo-500 to-violet-700 text-white font-bold'
      } ${className}`}
      title={displayName}
    >
      {showImage ? (
        <img
          src={resolvedUrl}
          alt={alt || displayName}
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover ${roundedClassName} ${imgClassName}`}
        />
      ) : fallbackType === 'initials' && initials ? (
        <span className={`font-black tracking-wider ${sizeConfig.text}`}>
          {initials}
        </span>
      ) : (
        <UserIcon className={`${sizeConfig.icon} opacity-80`} />
      )}
    </div>
  );
};

export default ProfileAvatar;
