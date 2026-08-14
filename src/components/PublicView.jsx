import React from 'react';
import { usePublicSync } from '../hooks/usePublicSync';
import { getTypographyProps } from '../utils/typography';

const SYNC_LABELS = {
  connecting: 'Connecting…',
  live: 'Live',
  local: 'Same-device mode',
  unconfigured: 'Live sync unavailable',
  error: 'Connection error',
  closed: 'Sharing stopped',
};

function ShapedText({ as: Tag = 'span', children, fontFamily, className, style }) {
  const typography = getTypographyProps(React.Children.toArray(children).join(''), fontFamily, 0);
  return <Tag lang={typography.lang} className={className} style={{ ...typography.style, ...style }}>{children}</Tag>;
}

export default function PublicView({ roomId = '' }) {
  const { drawState, syncStatus, errorMessage } = usePublicSync({ roomId });

  if (!drawState) {
    return (
      <div className="flex flex-col gap-3 items-center justify-center min-h-screen bg-gray-100 text-gray-800 p-6 text-center">
        <p className="text-2xl font-semibold">Waiting for draw to start…</p>
        <p className="text-sm text-gray-600">{SYNC_LABELS[syncStatus]}</p>
        {roomId && <p className="text-xs text-gray-500">Room {roomId.slice(0, 8)}</p>}
        {errorMessage && <p role="alert" className="max-w-lg text-sm text-red-700">{errorMessage}</p>}
        {!roomId && <p className="max-w-lg text-sm text-amber-700">This link has no live room ID and can only receive updates from the same browser profile.</p>}
      </div>
    );
  }

  const {
    title = 'Lucky Draw',
    subtitle = '',
    titleFont = "'Lobster', 'Noto Sans Myanmar', sans-serif",
    subtitleFont = "'Noto Sans Myanmar', 'Myanmar Text', sans-serif",
    displayFont = "'Noto Sans Myanmar', 'Myanmar Text', sans-serif",
    logo,
    winnersHistory = [],
    operationMode = 'standard',
    lastAssignmentResult,
  } = drawState;
  const assignmentResult = lastAssignmentResult?.mode === operationMode ? lastAssignmentResult : null;
  const isTeamView = assignmentResult?.mode === 'team-divider';
  const isRoleView = assignmentResult?.mode === 'role-selector';
  const headingSuffix = isTeamView ? 'Teams' : isRoleView ? 'Role Assignments' : 'Winners';
  const vintageStyle = {
    fontFamily: "'Playfair Display', serif",
    backgroundColor: '#fdf6e3',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
  };

  return (
    <div style={vintageStyle} className="min-h-screen p-4 sm:p-8 text-[#3a2f2f]">
      <div title={errorMessage || undefined} className={`fixed top-3 right-3 z-20 rounded-full px-3 py-1 text-xs font-semibold shadow ${syncStatus === 'live' ? 'bg-green-600 text-white' : syncStatus === 'error' || syncStatus === 'unconfigured' || syncStatus === 'closed' ? 'bg-red-600 text-white' : 'bg-amber-400 text-gray-900'}`}>
        {SYNC_LABELS[syncStatus]}
      </div>
      <div className="max-w-4xl mx-auto">
        {errorMessage && <p role="alert" className="mb-4 rounded bg-red-100 px-3 py-2 text-center text-sm text-red-800">{errorMessage}</p>}
        {logo && <img src={logo} alt="Event Logo" className="h-24 w-auto mx-auto mb-6" />}
        <ShapedText as="h1" fontFamily={titleFont} className="text-3xl sm:text-5xl font-bold text-center break-words">{title} - {headingSuffix}</ShapedText>
        {subtitle && <ShapedText as="p" fontFamily={subtitleFont} className="mt-2 mb-6 sm:mb-8 text-center text-lg sm:text-xl break-words text-[#665757]">{subtitle}</ShapedText>}
        {!subtitle && <div className="mb-6 sm:mb-8" />}
        {isTeamView ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {assignmentResult.teams.map((team, index) => (
              <div key={`${team.teamName}-${index}`} className="bg-white bg-opacity-50 p-4 sm:p-6 rounded-lg shadow-lg border border-gray-300 min-w-0">
                <ShapedText as="h3" fontFamily={titleFont} className="text-2xl sm:text-3xl font-bold border-b-2 border-gray-300 pb-2 mb-4 break-words">{team.teamName}</ShapedText>
                <ul className="space-y-2">
                  {team.members.map((member, memberIndex) => <ShapedText as="li" fontFamily={displayFont} key={`${member}-${memberIndex}`} className="text-xl sm:text-2xl bg-gray-100 px-3 py-1 rounded break-words">{member}</ShapedText>)}
                </ul>
              </div>
            ))}
          </div>
        ) : isRoleView ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {assignmentResult.assignments.map((assignment, index) => (
              <div key={`${assignment.role}-${index}`} className="bg-white bg-opacity-50 p-4 sm:p-6 rounded-lg shadow-lg border border-gray-300 min-w-0">
                <ShapedText as="h3" fontFamily={titleFont} className="text-2xl sm:text-3xl font-bold border-b-2 border-gray-300 pb-2 mb-4 break-words">{assignment.role}</ShapedText>
                <ul className="space-y-2">
                  {assignment.participants.map((participant, participantIndex) => <ShapedText as="li" fontFamily={displayFont} key={`${participant}-${participantIndex}`} className="text-xl sm:text-2xl bg-gray-100 px-3 py-1 rounded break-words">{participant}</ShapedText>)}
                </ul>
              </div>
            ))}
          </div>
        ) : winnersHistory.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {winnersHistory.map((group, groupIndex) => (
              <div key={`${group.prize}-${groupIndex}`} className="bg-white bg-opacity-50 p-4 sm:p-6 rounded-lg shadow-lg border border-gray-300 min-w-0">
                <ShapedText as="h3" fontFamily={titleFont} className="text-2xl sm:text-3xl font-bold border-b-2 border-gray-300 pb-2 mb-4 break-words">{group.prize}</ShapedText>
                <ul className="space-y-2">
                  {group.tickets.map((ticket, ticketIndex) => <ShapedText as="li" fontFamily={displayFont} key={`${ticket}-${ticketIndex}`} className="text-xl sm:text-2xl bg-gray-100 px-3 py-1 rounded break-words">{ticket}</ShapedText>)}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-2xl mt-16">Winners will be displayed here as they are drawn...</p>
        )}
      </div>
    </div>
  );
}
