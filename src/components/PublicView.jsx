import React from 'react';
import { usePublicSync } from '../hooks/usePublicSync';

export default function PublicView() {
  const drawState = usePublicSync();

  if (!drawState) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-800">Waiting for draw to start...</div>;
  }

  const { title = 'Lucky Draw', logo, winnersHistory = [], operationMode = 'standard', lastAssignmentResult } = drawState;
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
      <div className="max-w-4xl mx-auto">
        {logo && <img src={logo} alt="Event Logo" className="h-24 w-auto mx-auto mb-6" />}
        <h1 className="text-3xl sm:text-5xl font-bold text-center mb-6 sm:mb-8 break-words" style={{ fontFamily: "'Lobster', cursive" }}>{title} - {headingSuffix}</h1>
        {isTeamView ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {assignmentResult.teams.map((team, index) => (
              <div key={`${team.teamName}-${index}`} className="bg-white bg-opacity-50 p-4 sm:p-6 rounded-lg shadow-lg border border-gray-300 min-w-0">
                <h3 className="text-2xl sm:text-3xl font-bold border-b-2 border-gray-300 pb-2 mb-4 break-words" style={{ fontFamily: "'Lobster', cursive" }}>{team.teamName}</h3>
                <ul className="space-y-2">
                  {team.members.map((member, memberIndex) => <li key={`${member}-${memberIndex}`} className="text-xl sm:text-2xl bg-gray-100 px-3 py-1 rounded break-words">{member}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ) : isRoleView ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {assignmentResult.assignments.map((assignment, index) => (
              <div key={`${assignment.role}-${index}`} className="bg-white bg-opacity-50 p-4 sm:p-6 rounded-lg shadow-lg border border-gray-300 min-w-0">
                <h3 className="text-2xl sm:text-3xl font-bold border-b-2 border-gray-300 pb-2 mb-4 break-words" style={{ fontFamily: "'Lobster', cursive" }}>{assignment.role}</h3>
                <ul className="space-y-2">
                  {assignment.participants.map((participant, participantIndex) => <li key={`${participant}-${participantIndex}`} className="text-xl sm:text-2xl bg-gray-100 px-3 py-1 rounded break-words">{participant}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ) : winnersHistory.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {winnersHistory.map((group, groupIndex) => (
              <div key={`${group.prize}-${groupIndex}`} className="bg-white bg-opacity-50 p-4 sm:p-6 rounded-lg shadow-lg border border-gray-300 min-w-0">
                <h3 className="text-2xl sm:text-3xl font-bold border-b-2 border-gray-300 pb-2 mb-4 break-words" style={{ fontFamily: "'Lobster', cursive" }}>{group.prize}</h3>
                <ul className="space-y-2">
                  {group.tickets.map((ticket, ticketIndex) => <li key={`${ticket}-${ticketIndex}`} className="font-mono text-xl sm:text-2xl bg-gray-100 px-3 py-1 rounded break-words">{ticket}</li>)}
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
