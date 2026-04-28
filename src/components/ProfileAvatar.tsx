import React from 'react';

interface ProfileAvatarProps {
  name: string;
  profilePic?: string | null;
  size?: number;
  style?: React.CSSProperties;
}

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({ name, profilePic, size = 40, style }) => {
  const initial = name?.charAt(0)?.toUpperCase() || '?';

  // Color from name
  const colors = [
    ['#8B5CF6', '#6D28D9'],
    ['#EC4899', '#BE185D'],
    ['#F59E0B', '#D97706'],
    ['#10B981', '#059669'],
    ['#3B82F6', '#1D4ED8'],
    ['#EF4444', '#B91C1C'],
  ];
  const colorIdx = (name?.charCodeAt(0) || 0) % colors.length;
  const [c1, c2] = colors[colorIdx];

  if (profilePic) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(255,255,255,0.12)', ...style }}>
        <img src={profilePic} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${c1}, ${c2})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: size * 0.4,
      fontWeight: 800,
      fontFamily: "'Poppins', sans-serif",
      flexShrink: 0,
      boxShadow: `0 0 0 2px rgba(255,255,255,0.1)`,
      ...style,
    }}>
      {initial}
    </div>
  );
};

export default ProfileAvatar;
