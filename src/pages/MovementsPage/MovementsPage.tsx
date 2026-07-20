import { ColumnDef } from '@tanstack/react-table';
import { useCallback, useState } from 'react';
import {
  NumberParam,
  StringParam,
  useQueryParams,
  withDefault,
} from 'use-query-params';

import { useMovements } from '~/api';
import { Page } from '~/components';
import { Button } from '~/components/ui/button';
import { DataTable } from '~/components/ui/data-table';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useDebouncedCallback } from '~/hooks/useDebouncedCallback';
import { DifficultyLevel, Equipment, Movement, MuscleGroup } from '~/types';

export const MovementsPage = () => {
  const [queryParams, setQueryParams] = useQueryParams({
    page: withDefault(NumberParam, 1),
    muscleGroup: withDefault(StringParam, undefined),
    equipment: withDefault(StringParam, undefined),
    difficultyLevel: withDefault(StringParam, undefined),
    orderBy: withDefault(StringParam, 'Movement'),
    order: withDefault(StringParam, 'ASC'),
    search: withDefault(StringParam, undefined),
  });

  const [searchInput, setSearchInput] = useState(queryParams.search);

  const hasActiveFilters =
    queryParams.muscleGroup !== undefined ||
    queryParams.equipment !== undefined ||
    queryParams.difficultyLevel !== undefined ||
    queryParams.search !== undefined ||
    queryParams.orderBy !== 'Movement' ||
    queryParams.order !== 'ASC';

  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setQueryParams({ search: value || undefined, page: undefined });
  });

  const { data, isLoading } = useMovements({
    page: queryParams.page,
    limit: PAGE_SIZE,
    order: queryParams.order as 'ASC' | 'DESC',
    orderBy: queryParams.orderBy,
    where: {
      difficultyLevel: queryParams.difficultyLevel as DifficultyLevel,
      equipment: queryParams.equipment as Equipment,
      movementName: queryParams.search,
      muscleGroup: queryParams.muscleGroup as MuscleGroup,
    },
  });

  const movements = data?.movements ?? [];
  const rowCount = data?.count ?? 0;
  const hasNextPage = data?.hasNextPage ?? false;
  const hasPreviousPage = data?.hasPreviousPage ?? false;

  const handleClickNextPage = () => {
    setQueryParams({ page: queryParams.page + 1 });
  };
  const handleClickPreviousPage = () => {
    setQueryParams({ page: queryParams.page - 1 });
  };
  const handleClickFirstPage = () => {
    setQueryParams({ page: 1 });
  };
  const handleClickLastPage = () => {
    setQueryParams({ page: Math.ceil(rowCount / PAGE_SIZE) });
  };
  const handleFilterByMuscleGroup = (value: string | undefined) => {
    setQueryParams({ muscleGroup: value, page: undefined });
  };
  const handleFilterByEquipment = (value: string | undefined) => {
    setQueryParams({ equipment: value, page: undefined });
  };
  const handleFilterByDifficulty = (value: string | undefined) => {
    setQueryParams({ difficultyLevel: value, page: undefined });
  };
  const handleSearch = useCallback(
    (value: string) => {
      setSearchInput(value);
      debouncedSetSearch(value);
    },
    [debouncedSetSearch],
  );
  const handleSort = (columnId: string) => {
    setQueryParams({
      orderBy: columnId,
      order:
        queryParams.orderBy === columnId && queryParams.order === 'ASC'
          ? 'DESC'
          : 'ASC',
      page: undefined,
    });
  };

  const handleResetFilters = () => {
    setQueryParams({
      difficultyLevel: undefined,
      equipment: undefined,
      muscleGroup: undefined,
      order: undefined,
      orderBy: undefined,
      page: undefined,
      search: undefined,
    });
    setSearchInput('');
  };

  return (
    <Page title="Movements" width="full">
      <div className="mb-2 flex items-center gap-2">
        <Input
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search movements..."
          value={searchInput}
        />

        <Select
          value={queryParams.muscleGroup || ''}
          onValueChange={handleFilterByMuscleGroup}
          showReset={!!queryParams.muscleGroup}
          onReset={() => handleFilterByMuscleGroup(undefined)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Muscle Group" />
          </SelectTrigger>
          <SelectContent>
            {MUSCLE_GROUPS.map((group) => (
              <SelectItem key={group} value={group}>
                {group}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={queryParams.equipment || ''}
          onValueChange={handleFilterByEquipment}
          showReset={!!queryParams.equipment}
          onReset={() => handleFilterByEquipment(undefined)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Equipment" />
          </SelectTrigger>
          <SelectContent>
            {EQUIPMENT_TYPES.map((equipment) => (
              <SelectItem key={equipment} value={equipment}>
                {equipment}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={queryParams.difficultyLevel || ''}
          onValueChange={handleFilterByDifficulty}
          showReset={!!queryParams.difficultyLevel}
          onReset={() => handleFilterByDifficulty(undefined)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            {DIFFICULTY_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={handleResetFilters}>
            Reset Filters
          </Button>
        )}
      </div>

      <DataTable
        columns={COLUMNS}
        currentPage={queryParams.page}
        data={movements}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
        isLoading={isLoading}
        onClickFirstPage={handleClickFirstPage}
        onClickLastPage={handleClickLastPage}
        onClickNextPage={handleClickNextPage}
        onClickPreviousPage={handleClickPreviousPage}
        onSort={handleSort}
        order={queryParams.order as 'ASC' | 'DESC'}
        orderBy={queryParams.orderBy}
        pageSize={PAGE_SIZE}
        rowCount={rowCount}
      />
    </Page>
  );
};

const COLUMNS: ColumnDef<Movement>[] = [
  {
    header: 'Movement',
    accessorKey: 'movementName',
    id: 'Movement',
  },
  {
    header: 'Target Muscle Group',
    accessorKey: 'targetMuscleGroup',
    id: 'Target Muscle Group',
  },
  {
    header: 'Equipment',
    accessorKey: 'primaryEquipment',
    id: 'Primary Equipment',
  },
  {
    header: 'Difficulty',
    accessorKey: 'difficultyLevel',
    id: 'Difficulty Level',
  },
];

const PAGE_SIZE = 25;

// Explore filter vocabularies — the value set of the self-authored slim catalog
// (PROD-153). Keep in sync with scripts/data/movements.csv.
const MUSCLE_GROUPS: MuscleGroup[] = [
  'Abdominals',
  'Adductors',
  'Back',
  'Calves',
  'Chest',
  'Forearms',
  'Glutes',
  'Hamstrings',
  'Quadriceps',
  'Shoulders',
  'Trapezius',
  'Triceps',
];

const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  'Beginner',
  'Intermediate',
  'Expert',
];

const EQUIPMENT_TYPES: Equipment[] = ['Bodyweight', 'Kettlebell'];
