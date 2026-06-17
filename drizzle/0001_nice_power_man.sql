CREATE TABLE `favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`trackId` varchar(255) NOT NULL,
	`trackTitle` text,
	`trackArtist` text,
	`trackThumbnail` text,
	`trackDuration` int,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `listeningHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`trackId` varchar(255) NOT NULL,
	`trackTitle` text,
	`trackArtist` text,
	`trackThumbnail` text,
	`trackDuration` int,
	`playedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `listeningHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `playlistTracks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`playlistId` int NOT NULL,
	`trackId` varchar(255) NOT NULL,
	`trackTitle` text,
	`trackArtist` text,
	`trackThumbnail` text,
	`trackDuration` int,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `playlistTracks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`thumbnail` text,
	`isPublic` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `playlists_id` PRIMARY KEY(`id`)
);
