/**
 * Business-layer surface for whole-database backup, so presentation code
 * reaches the data layer through here (layer rule: presentation → business →
 * data). Export/import semantics live in the repository.
 */

export {
	$exportAllStores,
	$importAllStores,
	$deleteAllStores,
	type BackupFile
} from '$lib/data/repository/backup-repository';
